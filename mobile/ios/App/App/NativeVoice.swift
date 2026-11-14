import UIKit
import WebKit
import Speech
import AVFoundation

/// Ephemeral system speech. No credentials, plans, files or Genie API calls.
final class NativeVoice: NSObject, WKScriptMessageHandler, AVSpeechSynthesizerDelegate {
    private struct Command {
        static let languages = ["de":"de-DE", "en":"en-GB", "es":"es-ES", "it":"it-IT", "cs":"cs-CZ",
                                "hu":"hu-HU", "nl":"nl-NL", "nl-BE":"nl-BE", "sv":"sv-SE"]
        let documentID: String, requestID: String, action: String
        let language: String?, text: String?
        init?(_ raw: Any) {
            guard let body = raw as? [String:Any],
                  Set(body.keys).isSubset(of: ["v","documentId","requestId","action","locale","text"]),
                  let version = body["v"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID(), version.doubleValue == 1,
                  let document = body["documentId"] as? String, let request = body["requestId"] as? String,
                  [document, request].allSatisfy({ $0.range(of: "^[A-Za-z0-9-]{16,64}$", options: .regularExpression) != nil }),
                  let action = body["action"] as? String,
                  ["capabilities","start","stop","cancel","speak","stopSpeaking"].contains(action) else { return nil }
            if ["capabilities","start","speak"].contains(action) {
                guard let locale = body["locale"] as? String, let tag = Self.languages[locale] else { return nil }
                language = tag
            } else {
                guard body["locale"] == nil else { return nil }
                language = nil
            }
            if action == "speak" {
                guard let value = body["text"] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      value.utf16.count <= 6000 else { return nil }
                text = value
            } else {
                guard body["text"] == nil else { return nil }
                text = nil
            }
            documentID = document; requestID = request; self.action = action
        }
    }
    private final class Request {
        let command: Command, url: URL
        let started = ProcessInfo.processInfo.systemUptime
        init(_ command: Command, url: URL) { self.command = command; self.url = url }
    }
    private weak var owner: CineGeniusViewController?
    private weak var webView: WKWebView?
    private let policy: WorkplaceOriginPolicy
    private var recording: Request?, speaking: Request?, readyToRecord: Request?
    private var permissionInFlight = false
    private var engine: AVAudioEngine?, recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var captureStarted: TimeInterval?, finalizationStarted: TimeInterval?
    private var tapInstalled = false, ownsAudioSession = false
    private let synthesizer = AVSpeechSynthesizer()
    private var utterance: AVSpeechUtterance?
    private var watchdog: Timer?
    private var observers: [NSObjectProtocol] = []

    init?(owner: CineGeniusViewController) {
        guard let webView = owner.webView, let configured = owner.bridge?.config.serverURL,
              let policy = WorkplaceOriginPolicy(configured: configured),
              let url = Bundle.main.resourceURL?.appendingPathComponent("public/voice.js"),
              let script = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        self.owner = owner; self.webView = webView; self.policy = policy
        super.init()
        synthesizer.delegate = self
        synthesizer.usesApplicationAudioSession = true
        let content = webView.configuration.userContentController
        content.add(self, name: "cinegeniusVoice")
        content.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        observe(UIApplication.willResignActiveNotification) { [weak self] _ in
            guard let self else { return }
            // Our own permission sheet must be allowed to finish. Active audio
            // always stops on interruption; there is no automatic audio resume.
            if self.captureStarted != nil || self.speaking != nil { self.cancelAll() }
        }
        observe(UIApplication.didEnterBackgroundNotification) { [weak self] _ in self?.cancelAll() }
        observe(UIApplication.didBecomeActiveNotification) { [weak self] _ in self?.beginAuthorizedCapture() }
        observe(AVAudioSession.interruptionNotification) { [weak self] notification in
            if (notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? NSNumber)?.uintValue == AVAudioSession.InterruptionType.began.rawValue {
                self?.cancelAll()
            }
        }
        observe(AVAudioSession.routeChangeNotification) { [weak self] notification in
            if (notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? NSNumber)?.uintValue == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue {
                self?.cancelAll()
            }
        }
        observe(AVAudioSession.mediaServicesWereResetNotification) { [weak self] _ in self?.cancelAll() }
    }
    private func observe(_ name: Notification.Name, action: @escaping (Notification) -> Void) {
        observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main, using: action))
    }
    deinit {
        watchdog?.invalidate()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        engine?.stop()
        if tapInstalled { engine?.inputNode.removeTap(onBus: 0) }
        recognitionRequest?.endAudio(); recognitionTask?.cancel()
        synthesizer.stopSpeaking(at: .immediate)
        if ownsAudioSession { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }
    private func current(_ request: Request, requireActive: Bool = true) -> Bool {
        guard let webView, let owner, owner.presentedViewController == nil, !owner.isOpeningWorkplace,
              owner.viewIfLoaded?.window != nil, webView.url == request.url,
              !requireActive || UIApplication.shared.applicationState == .active else { return false }
        return policy.permits(mainFrame: true, request: request.url, current: webView.url,
            securityScheme: request.url.scheme ?? "", securityHost: request.url.host ?? "", securityPort: request.url.port ?? 0)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "cinegeniusVoice", message.webView === webView,
              policy.permits(mainFrame: message.frameInfo.isMainFrame, request: message.frameInfo.request.url, current: webView?.url,
                securityScheme: message.frameInfo.securityOrigin.protocol, securityHost: message.frameInfo.securityOrigin.host,
                securityPort: message.frameInfo.securityOrigin.port),
              let command = Command(message.body), let url = webView?.url else { return }
        let request = Request(command, url: url)
        guard current(request) else { return }
        switch command.action {
        case "capabilities":
            let recognizer = speechRecognizer(command.language!)
            result(request, ["recognition": recognizer?.isAvailable == true,
                "synthesis": voice(command.language!) != nil,
                "systemServiceMayProcessAudio": recognizer?.supportsOnDeviceRecognition != true])
        case "start": start(request)
        case "stop": if targets(recording, command) { stopCapture() }
        case "cancel": if targets(recording, command) { finishRecording(code: "cancelled") }
        case "speak": speak(request)
        case "stopSpeaking": if targets(speaking, command) { finishSpeaking(code: "cancelled") }
        default: break
        }
    }
    private func targets(_ request: Request?, _ command: Command) -> Bool {
        request?.command.documentID == command.documentID && request?.command.requestID == command.requestID
    }
    private func send(_ request: Request, type: String, values: [String:Any]) {
        guard current(request, requireActive: false), let webView else { return }
        var body = values
        body["v"] = 1; body["documentId"] = request.command.documentID
        body["requestId"] = request.command.requestID; body["type"] = type
        guard let data = try? JSONSerialization.data(withJSONObject: body), let json = String(data: data, encoding: .utf8) else { return }
        // The receiver independently checks the initiating document and request.
        // JSON serialization ensures transcripts are data, never executable code.
        webView.evaluateJavaScript("window.__cinegeniusVoiceReceive?.(\(json));", completionHandler: nil)
    }
    private func fail(_ request: Request, _ code: String) { send(request, type: "error", values: ["code":code]) }
    private func result(_ request: Request, _ value: [String:Any] = [:]) { send(request, type: "result", values: ["result":value]) }
    private func state(_ request: Request, _ state: String, partial: String? = nil) {
        var values: [String:Any] = ["state":state]
        if let partial { values["partialText"] = String(partial.prefix(6000)) }
        send(request, type: "state", values: values)
    }
    private func speechRecognizer(_ tag: String) -> SFSpeechRecognizer? {
        let locale = Locale(identifier: tag)
        guard SFSpeechRecognizer.supportedLocales().contains(where: { $0.identifier.replacingOccurrences(of: "_", with: "-").lowercased() == tag.lowercased() }) else { return nil }
        return SFSpeechRecognizer(locale: locale)
    }
    private func start(_ request: Request) {
        guard recording == nil, !permissionInFlight else { fail(request, "busy"); return }
        guard let recognizer = speechRecognizer(request.command.language!) else { fail(request, "language-unavailable"); return }
        guard recognizer.isAvailable else { fail(request, "unavailable"); return }
        finishSpeaking(code: "cancelled")
        recording = request; self.recognizer = recognizer; permissionInFlight = true
        state(request, "requesting-permission"); watch()
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                guard self.recording === request, self.current(request, requireActive: false) else { self.permissionInFlight = false; return }
                guard status == .authorized else {
                    self.permissionInFlight = false; self.finishRecording(code: "permission-denied"); return
                }
                let completion: (Bool) -> Void = { [weak self] granted in
                    DispatchQueue.main.async {
                        guard let self else { return }
                        self.permissionInFlight = false
                        guard self.recording === request, self.current(request, requireActive: false) else { return }
                        guard granted else { self.finishRecording(code: "permission-denied"); return }
                        self.readyToRecord = request; self.beginAuthorizedCapture()
                    }
                }
                if #available(iOS 17.0, *) { AVAudioApplication.requestRecordPermission(completionHandler: completion) }
                else { AVAudioSession.sharedInstance().requestRecordPermission(completion) }
            }
        }
    }
    private func beginAuthorizedCapture() {
        guard let request = readyToRecord, recording === request, current(request) else { return }
        readyToRecord = nil
        guard let recognizer, recognizer.isAvailable else { finishRecording(code: "unavailable"); return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: [])
            try session.setActive(true); ownsAudioSession = true
            let engine = AVAudioEngine(); self.engine = engine
            let input = engine.inputNode, format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { finishRecording(code: "audio"); return }
            let buffer = SFSpeechAudioBufferRecognitionRequest(); recognitionRequest = buffer
            buffer.shouldReportPartialResults = true
            buffer.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { audio, _ in buffer.append(audio) }
            tapInstalled = true
            recognitionTask = recognizer.recognitionTask(with: buffer) { [weak self] response, error in
                DispatchQueue.main.async {
                    guard let self, self.recording === request, self.current(request) else { return }
                    if let response {
                        let text = response.bestTranscription.formattedString
                        if response.isFinal { self.finishRecording(text: text); return }
                        self.state(request, self.finalizationStarted == nil ? "listening" : "processing", partial: text)
                    }
                    if let error {
                        let code = (error as NSError).domain == NSURLErrorDomain ? "network" : "unavailable"
                        self.finishRecording(code: code)
                    }
                }
            }
            engine.prepare(); try engine.start()
            captureStarted = ProcessInfo.processInfo.systemUptime
            state(request, "listening")
        } catch { finishRecording(code: "audio") }
    }
    private func stopAudioCapture() {
        engine?.stop()
        if tapInstalled { engine?.inputNode.removeTap(onBus: 0); tapInstalled = false }
        recognitionRequest?.endAudio()
        releaseAudioSession()
    }
    private func stopCapture() {
        guard let request = recording, finalizationStarted == nil else { return }
        guard captureStarted != nil else { finishRecording(code: "cancelled"); return }
        finalizationStarted = ProcessInfo.processInfo.systemUptime
        stopAudioCapture(); state(request, "processing")
    }
    private func finishRecording(code: String? = nil, text: String? = nil) {
        guard let request = recording else { return }
        recording = nil; readyToRecord = nil
        stopAudioCapture(); recognitionTask?.cancel(); recognitionTask = nil
        recognitionRequest = nil; recognizer = nil; engine = nil
        captureStarted = nil; finalizationStarted = nil
        if let code { fail(request, code) }
        else if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if text.utf16.count <= 6000 { result(request, ["text":text]) } else { fail(request, "invalid-request") }
        } else { fail(request, "no-speech") }
    }
    private func voice(_ tag: String) -> AVSpeechSynthesisVoice? {
        // Restrict synthesis to installed Apple system voices, not an arbitrary
        // third-party voice provider with its own processing behavior.
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.identifier.hasPrefix("com.apple.") }
        return voices.first(where: { $0.language.caseInsensitiveCompare(tag) == .orderedSame })
            ?? voices.first(where: { $0.language.split(separator: "-").first == tag.split(separator: "-").first })
    }
    private func speak(_ request: Request) {
        guard let voice = voice(request.command.language!) else { fail(request, "language-unavailable"); return }
        finishRecording(code: "cancelled"); finishSpeaking(code: "cancelled")
        speaking = request
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true); ownsAudioSession = true
            let utterance = AVSpeechUtterance(string: request.command.text!)
            utterance.voice = voice; self.utterance = utterance
            state(request, "speaking"); watch(); synthesizer.speak(utterance)
        } catch { finishSpeaking(code: "audio") }
    }
    private func finishSpeaking(code: String? = nil) {
        guard let request = speaking else { return }
        speaking = nil; utterance = nil
        synthesizer.stopSpeaking(at: .immediate); releaseAudioSession()
        if let code { fail(request, code) } else { result(request) }
    }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        if self.utterance === utterance { finishSpeaking() }
    }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        if self.utterance === utterance { finishSpeaking(code: "interrupted") }
    }
    private func releaseAudioSession() {
        if ownsAudioSession { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation); ownsAudioSession = false }
    }
    private func watch() {
        guard watchdog == nil else { return }
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in self?.tick() }
        watchdog = timer; RunLoop.main.add(timer, forMode: .common)
    }
    private func tick() {
        let now = ProcessInfo.processInfo.systemUptime
        if let request = recording {
            if !current(request, requireActive: false) { finishRecording(code: "interrupted") }
            else if let finalizationStarted, now - finalizationStarted >= 8 { finishRecording(code: "timeout") }
            else if let captureStarted, now - captureStarted >= 30 { stopCapture() }
            else if captureStarted == nil, now - request.started >= 45 { finishRecording(code: "timeout") }
        }
        if let request = speaking {
            if !current(request) { finishSpeaking(code: "interrupted") }
            else if now - request.started >= 115 { finishSpeaking(code: "timeout") }
        }
        if recording == nil, speaking == nil { watchdog?.invalidate(); watchdog = nil }
    }
    func cancelAll() {
        finishRecording(code: "interrupted"); finishSpeaking(code: "interrupted")
        watchdog?.invalidate(); watchdog = nil
    }
    func navigationChanged() {
        // A queued URL observation must not cancel speech already started on
        // the new page. Each pending request still checks its initiating URL.
        tick()
    }
}
