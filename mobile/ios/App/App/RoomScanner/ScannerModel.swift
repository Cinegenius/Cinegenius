import SwiftUI
import RoomPlan
import AVFoundation
import LocalAuthentication

@available(iOS 16.0, *)
@MainActor final class ScannerModel: ObservableObject {
    enum CaptureState { case idle, requesting, scanning, processing }
    enum Pending { case close, back, rescan }
    @Published var captureState: CaptureState = .idle
    @Published var captureController: NativeRoomCaptureController?
    @Published var draft: SavedFloorPlan?
    @Published var name = ""
    @Published var project = ""
    @Published var saved = false
    @Published var plans: [SavedFloorPlan] = []
    @Published var unlocked = false
    @Published var needsUnlock = false
    @Published var covered = false
    @Published var busy = false
    @Published var notice: String?
    @Published var pending: Pending?
    @Published var showDiscardPrompt = false
    @Published var deleteTarget: SavedFloorPlan?
    @Published var share: PlanShare?
    let strings: ScannerStrings
    let archive: PlanArchive
    var onClose: (() -> Void)?
    var onBack: (() -> Void)?
    private var rawRoom: CapturedRoom?
    private var stableRoomData: Data?
    private var captureID: UUID?
    private var authID: UUID?
    private var authContext: LAContext?
    private var processingTimeout: Task<Void,Never>?
    private var observers: [NSObjectProtocol] = []
    var supported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return RoomCaptureSession.isSupported
        #endif
    }
    var hasWork: Bool { (draft != nil && !saved) || captureState != .idle }
    var cameraDenied: Bool { [.denied,.restricted].contains(AVCaptureDevice.authorizationStatus(for:.video)) }
    init(strings: ScannerStrings) {
        self.strings = strings
        let appSupport = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
        archive = PlanArchive(root: appSupport.appendingPathComponent("CineGeniusPrivateFloorPlans",isDirectory:true))
        PlanExports.removeStaleExports()
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.covered = true } })
        observers.append(center.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.lockForBackground() } })
        observers.append(center.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.covered = false } })
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver); processingTimeout?.cancel() }
    func lockForBackground() {
        covered = true
        needsUnlock = unlocked || (draft != nil && (saved || draft?.plan.source == .sensor))
        unlocked = false; plans = []
        if saved { draft = nil; name = ""; project = ""; rawRoom = nil; stableRoomData = nil }
        authID = nil; authContext?.invalidate(); authContext = nil
        if captureState != .idle { stopCapture(); notice = "interruptedBody" }
        // An explicitly started activity owns its protected file until completion.
        // Switching to its destination is not a cancellation of that transfer.
    }
    func unlock() async -> Bool {
        if unlocked { return true }
        guard authID == nil else { return false }
        let context = LAContext(); var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication,error:&error) else { notice = "lockUnavailable"; return false }
        let token = UUID(); authID = token; authContext = context
        let success = await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication,localizedReason:strings.text("localAuthReason")) { success,_ in continuation.resume(returning:success) }
        }
        guard authID == token else { return false }
        authID = nil; authContext = nil
        guard success, UIApplication.shared.applicationState != .background else { notice = "locked"; return false }
        unlocked = true; needsUnlock = false
        return true
    }
    func loadLibrary() async {
        guard !busy, await unlock() else { return }
        busy = true; defer { busy = false }
        do { let loaded = try await archive.list(); guard unlocked else { return }; plans = loaded }
        catch { notice = "loadFailed" }
    }
    func example() {
        stopCapture(); rawRoom = nil; stableRoomData = nil
        draft = try? SavedFloorPlan(name:strings.text("sampleTitle"),localProject:"",plan:.example)
        name = strings.text("sampleTitle"); project = ""; saved = false
    }
    func viewSaved(_ plan: SavedFloorPlan) {
        guard unlocked else { return }
        draft = plan; name = plan.name; project = plan.localProject; saved = true; rawRoom = nil
        stableRoomData = plan.capturedRoomData
        if plan.plan.source == .sensor, let data = plan.capturedRoomData, let room = try? JSONDecoder().decode(CapturedRoom.self,from:data), (try? NativeRoomCaptureController.project(room)) == plan.plan { rawRoom = room }
    }
    func startCapture() async {
        guard supported, captureState == .idle, !busy else { return }
        let id = UUID(); captureID = id; captureState = .requesting
        let status = AVCaptureDevice.authorizationStatus(for:.video)
        let granted: Bool
        switch status {
        case .authorized: granted = true
        case .notDetermined: granted = await AVCaptureDevice.requestAccess(for:.video)
        default: granted = false
        }
        guard captureID == id, UIApplication.shared.applicationState != .background else { return }
        guard granted else { captureState = .idle; captureID = nil; notice = status == .restricted ? "cameraRestricted" : "cameraBody"; return }
        let controller = NativeRoomCaptureController()
        controller.onResult = { [weak self] result in
            Task { @MainActor in
                guard let self, self.captureID == id else { return }
                self.processingTimeout?.cancel(); self.captureID = nil
                self.captureState = .idle; self.captureController = nil
                switch result {
                case .success(let (plan,room)):
                    self.rawRoom = room
                    self.stableRoomData = try? CapturedSourceEncoding.encode(room)
                    self.draft = try? SavedFloorPlan(name:self.strings.text("defaultRoom"),localProject:"",plan:plan)
                    self.name = self.strings.text("defaultRoom"); self.project = ""; self.saved = false
                case .failure(let error): self.notice = error is PlanError ? "noGeometry" : "scanFailed"
                }
            }
        }
        captureController = controller; captureState = .scanning
    }
    func finishCapture() {
        guard captureState == .scanning else { return }
        captureState = .processing; captureController?.finish()
        let id = captureID
        processingTimeout = Task { [weak self] in
            try? await Task.sleep(nanoseconds:90_000_000_000)
            guard !Task.isCancelled, let self, self.captureID == id, self.captureState == .processing else { return }
            self.stopCapture(); self.notice = "scanFailed"
        }
    }
    func stopCapture() {
        captureID = nil; processingTimeout?.cancel(); processingTimeout = nil
        captureController?.cancel(); captureController = nil; captureState = .idle
    }
    func request(_ action: Pending) {
        guard !busy else { return }
        if hasWork { pending = action; showDiscardPrompt = true } else { perform(action) }
    }
    func perform(_ action: Pending) {
        pending = nil; showDiscardPrompt = false; stopCapture()
        switch action {
        case .close: draft = nil; rawRoom = nil; stableRoomData = nil; plans = []; name = ""; project = ""; finishedSharing(); onClose?()
        case .back:
            if draft != nil { draft = nil; rawRoom = nil; stableRoomData = nil; name = ""; project = ""; saved = false }
            else { onBack?() }
        case .rescan: draft = nil; rawRoom = nil; stableRoomData = nil; Task { await startCapture() }
        }
    }
    func save() async {
        guard !busy, let draft, !saved else { return }
        guard !name.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else { notice = "nameRequired"; return }
        guard name.count <= 100, project.count <= 100 else { notice = "nameTooLong"; return }
        guard await unlock() else { return }
        busy = true; defer { busy = false }
        do {
            if stableRoomData == nil, let rawRoom { stableRoomData = try CapturedSourceEncoding.encode(rawRoom) }
            let source = stableRoomData ?? draft.capturedRoomData
            let record = try SavedFloorPlan(id:draft.id,createdAt:draft.createdAt,name:name,localProject:project,plan:draft.plan,capturedRoomData:source)
            try await archive.save(record)
            guard unlocked else { return }
            self.draft = record; saved = true
            if !plans.contains(where:{$0.id == record.id}) { plans.insert(record,at:0) }
            if let pending { perform(pending) } else { notice = "saveSuccess" }
        } catch { notice = "saveFailed" } // Keep the entire result and all entered fields.
    }
    func deleteConfirmed(_ target: SavedFloorPlan) async {
        guard unlocked, !busy else { return }
        deleteTarget = nil; busy = true; defer { busy = false }
        do { try await archive.delete(id:target.id); plans.removeAll {$0.id == target.id}; if saved && draft?.id == target.id { draft = nil; rawRoom = nil; name = ""; project = ""; saved = false } }
        catch { notice = "deleteFailed" }
    }
    func recordForExport() throws -> SavedFloorPlan {
        guard let draft, !needsUnlock else { throw PlanError.invalidArchive }
        return try SavedFloorPlan(id:draft.id,createdAt:draft.createdAt,name:name,localProject:project,plan:draft.plan)
    }
    func export(model: Bool) {
        guard !busy, !needsUnlock, !covered else { return }
        do {
            let record = try recordForExport()
            if model {
                guard record.plan.source == .sensor, let room = rawRoom else { notice = "modelUnavailable"; return }
                share = try PlanExports.model(room)
            } else { share = try PlanExports.pdf(record,strings:strings) }
        } catch { notice = "exportFailed" }
    }
    var canExportModel: Bool { draft?.plan.source == .sensor }
    func finishedSharing() { if let share { PlanExports.clean(share) }; share = nil }
}
