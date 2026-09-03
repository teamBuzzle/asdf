use std::cell::RefCell;

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject, Sel};
use objc2::{define_class, msg_send, ClassType, DefinedClass, MainThreadOnly};
use objc2_app_kit::{
    NSEvent, NSEventMask, NSEventType, NSTextInputClient, NSTextInputContext, NSView,
};
use objc2_foundation::{
    MainThreadMarker, NSArray, NSAttributedString, NSNotFound, NSPoint, NSRange, NSRect, NSSize,
    NSString,
};
use tauri::{Emitter, Runtime, WebviewWindow};

/// Traces every IME callback when `ASDF_IME_TRACE` is set. `scripts/ime-check.sh`
/// reads this to assert what the terminal actually received, which is the only
/// way to check composition without a human at the keyboard.
fn trace(args: std::fmt::Arguments<'_>) {
    use std::sync::OnceLock;
    static ON: OnceLock<bool> = OnceLock::new();
    if *ON.get_or_init(|| std::env::var_os("ASDF_IME_TRACE").is_some()) {
        eprintln!("[ime] {args}");
    }
}

/// Committed text, ready for the pty.
pub const COMMIT_EVENT: &str = "ime://commit";
/// Text still being composed. Replaces whatever the previous preedit was.
pub const PREEDIT_EVENT: &str = "ime://preedit";

// Text Input Sources lives in Carbon. NSTextInputContext cannot answer this
// question before it has handled an event, which left the first keystroke of a
// session being judged against a stale source and delivered as ASCII.
#[link(name = "Carbon", kind = "framework")]
unsafe extern "C" {
    fn TISCopyCurrentKeyboardInputSource() -> *mut AnyObject;
    fn TISGetInputSourceProperty(source: *mut AnyObject, key: *const AnyObject) -> *mut AnyObject;
    static kTISPropertyInputSourceID: *const AnyObject;
}

/// Identifier of the keyboard input source the user has selected right now.
fn current_input_source() -> String {
    unsafe {
        let source = TISCopyCurrentKeyboardInputSource();
        if source.is_null() {
            return String::new();
        }
        let id = TISGetInputSourceProperty(source, kTISPropertyInputSourceID);
        if id.is_null() {
            return String::new();
        }
        let id: &NSString = &*(id as *const NSString);
        id.to_string()
    }
}

/// Input source identifiers whose composition WebKit mishandles. Anything else —
/// including plain ASCII typing — is left to the webview.
fn is_composing_source(id: &str) -> bool {
    const COMPOSED: [&str; 6] = [
        "com.apple.inputmethod.Korean",
        "com.apple.inputmethod.Japanese",
        "com.apple.inputmethod.SCIM",
        "com.apple.inputmethod.TCIM",
        "com.apple.inputmethod.TYIM",
        "com.apple.inputmethod.VietnameseIM",
    ];
    COMPOSED.iter().any(|prefix| id.starts_with(prefix))
}

/// Whether the callbacks should forward anything right now.
///
/// The client view sits in the responder chain with an activated text input
/// context, so AppKit delivers text to it even for keystrokes the monitor
/// deliberately passed through to the webview. Without this check those arrive
/// twice: once from here and once from xterm.
fn should_forward() -> bool {
    is_composing_source(&current_input_source())
}

/// Delivers `(event name, payload)` to the frontend.
type Sink = Box<dyn Fn(&str, &str)>;

#[derive(Default)]
struct ClientState {
    marked: String,
    sink: Option<Sink>,
}

define_class!(
    /// Receives AppKit's text input callbacks in place of the webview.
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    #[name = "AsdfImeClient"]
    #[ivars = RefCell<ClientState>]
    struct ImeClient;

    unsafe impl NSTextInputClient for ImeClient {
        #[unsafe(method(insertText:replacementRange:))]
        fn insert_text(&self, text: &AnyObject, _range: NSRange) {
            let text = describe(text);
            trace(format_args!("insertText {text:?}"));
            let mut state = self.ivars().borrow_mut();
            state.marked.clear();
            if !should_forward() {
                return;
            }
            if let Some(sink) = state.sink.as_ref() {
                sink(PREEDIT_EVENT, "");
                if !text.is_empty() {
                    sink(COMMIT_EVENT, &text);
                }
            }
        }

        #[unsafe(method(setMarkedText:selectedRange:replacementRange:))]
        fn set_marked_text(&self, text: &AnyObject, _selected: NSRange, _replacement: NSRange) {
            let text = describe(text);
            trace(format_args!("setMarkedText {text:?}"));
            let mut state = self.ivars().borrow_mut();
            state.marked = text.clone();
            if !should_forward() {
                return;
            }
            if let Some(sink) = state.sink.as_ref() {
                sink(PREEDIT_EVENT, &text);
            }
        }

        #[unsafe(method(unmarkText))]
        fn unmark_text(&self) {
            let mut state = self.ivars().borrow_mut();
            state.marked.clear();
            if let Some(sink) = state.sink.as_ref() {
                sink(PREEDIT_EVENT, "");
            }
        }

        #[unsafe(method(hasMarkedText))]
        fn has_marked_text(&self) -> bool {
            !self.ivars().borrow().marked.is_empty()
        }

        #[unsafe(method(markedRange))]
        fn marked_range(&self) -> NSRange {
            let len = self.ivars().borrow().marked.chars().count();
            if len == 0 {
                NSRange::new(NSNotFound as usize, 0)
            } else {
                NSRange::new(0, len)
            }
        }

        #[unsafe(method(selectedRange))]
        fn selected_range(&self) -> NSRange {
            NSRange::new(0, 0)
        }

        #[unsafe(method_id(validAttributesForMarkedText))]
        fn valid_attributes(&self) -> Retained<NSArray<NSString>> {
            NSArray::new()
        }

        #[unsafe(method_id(attributedSubstringForProposedRange:actualRange:))]
        fn attributed_substring(
            &self,
            _range: NSRange,
            _actual: *mut NSRange,
        ) -> Option<Retained<NSAttributedString>> {
            None
        }

        #[unsafe(method(firstRectForCharacterRange:actualRange:))]
        fn first_rect(&self, _range: NSRange, _actual: *mut NSRange) -> NSRect {
            // The candidate window anchors here. Reported in screen coordinates;
            // the frontend draws its own preedit, so a zero-size rect at the
            // window origin is enough to keep AppKit from misplacing it wildly.
            let origin = self
                .window()
                .map(|window| window.frame().origin)
                .unwrap_or(NSPoint::new(0.0, 0.0));
            NSRect::new(origin, NSSize::new(0.0, 0.0))
        }

        #[unsafe(method(characterIndexForPoint:))]
        fn character_index(&self, _point: NSPoint) -> usize {
            NSNotFound as usize
        }

        #[unsafe(method(doCommandBySelector:))]
        fn do_command(&self, selector: Sel) {
            if !should_forward() {
                return;
            }
            // While a CJK source is active the event never reaches the webview,
            // so the keys the IME declines have to be translated here.
            let sequence = match selector.name().to_str().unwrap_or_default() {
                "insertNewline:" => "\r",
                "insertTab:" => "\t",
                "insertBacktab:" => "\u{1b}[Z",
                "deleteBackward:" => "\u{7f}",
                "deleteForward:" => "\u{1b}[3~",
                "moveLeft:" => "\u{1b}[D",
                "moveRight:" => "\u{1b}[C",
                "moveUp:" => "\u{1b}[A",
                "moveDown:" => "\u{1b}[B",
                "cancelOperation:" => "\u{1b}",
                _ => return,
            };
            if let Some(sink) = self.ivars().borrow().sink.as_ref() {
                sink(COMMIT_EVENT, sequence);
            }
        }
    }
);

impl ImeClient {
    fn new(mtm: MainThreadMarker, sink: Sink) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(RefCell::new(ClientState {
            marked: String::new(),
            sink: Some(sink),
        }));
        unsafe { msg_send![super(this), init] }
    }
}

/// `insertText:` and `setMarkedText:` are documented to pass either an
/// `NSString` or an `NSAttributedString`.
fn describe(text: &AnyObject) -> String {
    unsafe {
        let is_attributed: bool = msg_send![text, isKindOfClass: NSAttributedString::class()];
        let string: Retained<NSString> = if is_attributed {
            msg_send![text, string]
        } else {
            msg_send![text, self]
        };
        string.to_string()
    }
}

/// Installs the interception on `window`. Safe to call once per window.
pub fn install<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("IME setup must run on the main thread")?;

    let emitter = window.clone();
    let client = ImeClient::new(
        mtm,
        Box::new(move |event, payload| {
            let _ = emitter.emit(event, payload.to_owned());
        }),
    );

    // Parent the view so AppKit treats it as part of a real window; it is never
    // made first responder and draws nothing.
    let ns_view = window.ns_view().map_err(|err| err.to_string())? as *mut NSView;
    if let Some(parent) = unsafe { ns_view.as_ref() } {
        parent.addSubview(&client);
    }

    let context = NSTextInputContext::initWithClient(
        NSTextInputContext::alloc(mtm),
        ProtocolObject::from_ref(&*client),
    );

    // Activate up front. Doing it only inside the handler leaves the first few
    // keystrokes of a session to be delivered raw, because activation does not
    // take effect until after the event that triggered it.
    context.activate();

    let context_for_handler = context.clone();
    let block = block2::RcBlock::new(move |event: core::ptr::NonNull<NSEvent>| -> *mut NSEvent {
        let event_ref = unsafe { event.as_ref() };

        // Anything that is not a key press is only here to warm the context up.
        // Establishing the input method server connection takes a moment, and
        // until it exists the IME commits raw characters instead of composing —
        // which is why the first two keystrokes of a session used to escape.
        // Clicks and modifier presses always precede typing, so activating on
        // them means the session is ready before the first real character.
        let kind = event_ref.r#type();
        if kind != NSEventType::KeyDown {
            // Activation alone does not complete the input method handshake: the
            // first handleEvent does, and it consumes its own event doing so.
            // Spend that first call on a mouse or modifier event, which always
            // precedes typing, so no character is lost to the handshake.
            context_for_handler.activate();
            let _ = context_for_handler.handleEvent(event_ref);
            return event.as_ptr();
        }
        let source = current_input_source();
        let key_code: u16 = event_ref.keyCode();
        let chars = event_ref
            .characters()
            .map(|c| c.to_string())
            .unwrap_or_default();
        trace(format_args!(
            "keyDown code={key_code} chars={chars:?} source={source:?} composing={}",
            is_composing_source(&source)
        ));

        if !is_composing_source(&source) {
            return event.as_ptr();
        }

        // Re-activate in case the webview took the input context back on focus.
        context_for_handler.activate();

        let _ = context_for_handler.handleEvent(event_ref);

        // Always consume. handleEvent reports false for keys the IME declines,
        // and passing those on would deliver every keystroke twice: once from
        // insertText: here and once through the webview.
        core::ptr::null_mut()
    });

    unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(
            NSEventMask::KeyDown
                | NSEventMask::FlagsChanged
                | NSEventMask::LeftMouseDown
                | NSEventMask::MouseMoved,
            &block,
        );
    }

    // Both objects must outlive the monitor.
    std::mem::forget(client);
    std::mem::forget(context);
    Ok(())
}
