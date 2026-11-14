import SwiftUI
import RoomPlan
import AVFoundation
import LocalAuthentication
import CryptoKit

@available(iOS 16.0, *)
@MainActor final class ScannerModel: ObservableObject {
    enum CaptureState { case idle, requesting, scanning, processing }
    enum Pending { case close, back, rescan }
    @Published var editorPresented = false
    @Published var captureState: CaptureState = .idle
    @Published var captureController: NativeRoomCaptureController?
    @Published var draft: SavedFloorPlan?
    @Published var name = "" { didSet { updateSavedState() } }
    @Published var project = "" { didSet { updateSavedState() } }
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
    @Published var locations: [WorkplaceLocation] = []
    @Published var selectedLocation: WorkplaceLocation?
    @Published var history = PlanEditHistory()
    @Published var selectedObjectID: UUID?
    @Published var accountReady = true
    @Published var locationsLimited = false
    let accountID: String
    let legacyArchiveExists: Bool
    private let access: () async throws -> WorkplaceAccount
    private var baseline: SavedFloorPlan?
    let strings: ScannerStrings
    let archive: PlanArchive
    var onClose: (() -> Void)?
    var onSignIn: (() -> Void)?
    var onSuspend: (() -> Void)?
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
    init(strings: ScannerStrings, account: WorkplaceAccount, access: @escaping () async throws -> WorkplaceAccount) {
        self.strings = strings; self.accountID = account.accountID; self.access = access
        self.locations = account.locations; self.locationsLimited = account.limited
        let appSupport = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
        let legacy = appSupport.appendingPathComponent("CineGeniusPrivateFloorPlans",isDirectory:true)
        legacyArchiveExists = FileManager.default.fileExists(atPath: legacy.path)
        let accountKey = SHA256.hash(data: Data(account.accountID.utf8)).map { String(format: "%02x", $0) }.joined()
        archive = PlanArchive(root: appSupport.appendingPathComponent("CineGeniusAccountFloorPlans",isDirectory:true).appendingPathComponent(accountKey,isDirectory:true))
        PlanExports.removeStaleExports()
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.covered = true } })
        observers.append(center.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.lockForBackground() } })
        observers.append(center.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in Task { @MainActor in self?.covered = false } })
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver); processingTimeout?.cancel() }
    func lockForBackground() {
        covered = true
        needsUnlock = unlocked || draft != nil
        accountReady = false; locations = []
        unlocked = false; plans = []
        // Preserve the room and editor state behind the account/device lock.
        authID = nil; authContext?.invalidate(); authContext = nil
        if captureState != .idle { stopCapture(); notice = "interruptedBody" }
        // An explicitly started activity owns its protected file until completion.
        // Switching to its destination is not a cancellation of that transfer.
    }
    func unlock() async -> Bool {
        guard await refreshAccount() else { return false }
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
        guard !busy else { return }
        busy = true; defer { busy = false }
        guard await unlock() else { return }
        do { let loaded = try await archive.list(); guard unlocked else { return }; plans = loaded.filter { $0.ownerID == accountID && $0.locationID == selectedLocation?.id } }
        catch { notice = "loadFailed" }
    }
    func example() {
        guard accountReady, selectedLocation != nil, !busy else { return }
        baseline = nil; history = PlanEditHistory(); selectedObjectID = nil
        stopCapture(); rawRoom = nil; stableRoomData = nil
        draft = try? SavedFloorPlan(name:strings.text("sampleTitle"),localProject:"",plan:.example,ownerID:accountID,locationID:selectedLocation?.id)
        name = strings.text("sampleTitle"); project = ""; saved = false
    }
    func viewSaved(_ plan: SavedFloorPlan) {
        guard unlocked, accountReady, plan.ownerID == accountID, plan.locationID == selectedLocation?.id else { return }
        baseline = plan; history = PlanEditHistory(plan.objects); selectedObjectID = nil
        draft = plan; name = plan.name; project = plan.localProject; saved = true; rawRoom = nil
        stableRoomData = plan.capturedRoomData
        if plan.plan.source == .sensor, let data = plan.capturedRoomData, let room = try? JSONDecoder().decode(CapturedRoom.self,from:data), (try? NativeRoomCaptureController.project(room)) == plan.plan { rawRoom = room }
    }
    func startCapture() async {
        guard supported, captureState == .idle, !busy, selectedLocation != nil else { return }
        busy = true; defer { busy = false }
        guard await unlock() else { return }
        baseline = nil; history = PlanEditHistory(); selectedObjectID = nil
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
                    self.draft = try? SavedFloorPlan(name:self.strings.text("defaultRoom"),localProject:"",plan:plan,ownerID:self.accountID,locationID:self.selectedLocation?.id)
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
        case .close: clearDraft(); plans = []; finishedSharing(); onClose?()
        case .back:
            if draft != nil { clearDraft() }
            else { onBack?() }
        case .rescan: clearDraft(); Task { await startCapture() }
        }
    }
    func save() async {
        guard !busy, let draft, !saved, selectedLocation != nil else { return }
        guard !name.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else { notice = "nameRequired"; return }
        guard name.count <= 100, project.count <= 100 else { notice = "nameTooLong"; return }
        busy = true; defer { busy = false }
        guard await unlock() else { return }
        do {
            if stableRoomData == nil, let rawRoom { stableRoomData = try CapturedSourceEncoding.encode(rawRoom) }
            let source = stableRoomData ?? draft.capturedRoomData
            let record = try SavedFloorPlan(id:draft.id,createdAt:draft.createdAt,name:name,localProject:project,plan:draft.plan,capturedRoomData:source,ownerID:accountID,locationID:selectedLocation?.id,revision:baseline.map { $0.revision + 1 } ?? 0,objects:history.objects)
            if let baseline { try await archive.update(record,replacing:baseline) }
            else { try await archive.save(record) }
            guard unlocked else { return }
            baseline = record; self.draft = record; name = record.name; project = record.localProject; saved = true
            plans.removeAll { $0.id == record.id }; plans.insert(record,at:0)
            if let pending { perform(pending) } else { notice = "saveSuccess" }
        } catch { notice = "saveFailed" } // Keep the entire result and all entered fields.
    }
    func deleteConfirmed(_ target: SavedFloorPlan) async {
        guard !busy, target.ownerID == accountID, target.locationID == selectedLocation?.id else { return }
        deleteTarget = nil; busy = true; defer { busy = false }
        guard await unlock() else { return }
        do { try await archive.delete(id:target.id); plans.removeAll {$0.id == target.id}; if saved && draft?.id == target.id { clearDraft() } }
        catch { notice = "deleteFailed" }
    }
    func recordForExport() throws -> SavedFloorPlan {
        guard let draft, !needsUnlock else { throw PlanError.invalidArchive }
        return try SavedFloorPlan(id:draft.id,createdAt:draft.createdAt,name:name,localProject:project,plan:draft.plan,ownerID:accountID,locationID:selectedLocation?.id,objects:history.objects)
    }
    func export(model: Bool) async {
        guard !busy, !needsUnlock, !covered else { return }
        busy = true; defer { busy = false }
        guard await refreshAccount() else { return }
        do {
            let record = try recordForExport()
            if model {
                guard record.plan.source == .sensor, let room = rawRoom else { notice = "modelUnavailable"; return }
                share = try PlanExports.model(room)
            } else { share = try PlanExports.pdf(record,strings:strings,locationTitle:selectedLocation?.title ?? "") }
        } catch { notice = "exportFailed" }
    }
    func refreshAccount() async -> Bool {
        do {
            let current = try await access()
            guard current.accountID == accountID else { throw WorkplaceAccessError.accountChanged }
            if let selectedLocation, !current.locations.contains(where: { $0.id == selectedLocation.id }) { throw WorkplaceAccessError.accountChanged }
            locations = current.locations; locationsLimited = current.limited; accountReady = true
            return true
        } catch {
            accountReady = false; needsUnlock = true; unlocked = false; plans = []; locations = []
            stopCapture(); notice = (error as? WorkplaceAccessError)?.rawValue ?? "accountUnavailable"
            return false
        }
    }
    func selectLocation(_ location: WorkplaceLocation) async -> Bool {
        guard !hasWork, !busy else { return false }
        busy = true; defer { busy = false }
        guard await refreshAccount(), locations.contains(location) else { return false }
        clearDraft(); selectedLocation = location; plans = []
        guard await unlock() else { return false }
        do {
            let loaded = try await archive.list()
            guard unlocked else { return false }
            plans = loaded.filter { $0.ownerID == accountID && $0.locationID == location.id }
        } catch { notice = "loadFailed" }
        return true
    }
    func clearDraft() {
        draft = nil; baseline = nil; rawRoom = nil; stableRoomData = nil
        history = PlanEditHistory(); selectedObjectID = nil; name = ""; project = ""; saved = false
    }
    func updateSavedState() {
        saved = baseline != nil && name == baseline?.name && project == baseline?.localProject && history.objects == baseline?.objects
    }
    func applyObjects(_ objects: [PlanObject]) {
        guard accountReady, !needsUnlock, !busy, draft != nil else { return }
        do { try history.apply(objects); updateSavedState() } catch { notice = "invalidObject" }
    }
    func undo() { guard accountReady, !busy else { return }; history.undo(); selectedObjectID = nil; updateSavedState() }
    func redo() { guard accountReady, !busy else { return }; history.redo(); selectedObjectID = nil; updateSavedState() }
    func manualRoom(width: Double, depth: Double) {
        guard accountReady, selectedLocation != nil, !busy, width.isFinite, depth.isFinite,
              (0.5...100).contains(width), (0.5...100).contains(depth) else { notice = "invalidDimensions"; return }
        clearDraft()
        let points = [PlanPoint(0,0), PlanPoint(width,0), PlanPoint(width,depth), PlanPoint(0,depth)]
        do {
            let plan = try FloorPlan(source:.manual,segments:points.indices.map { PlanSegment(kind:.wall,start:points[$0],end:points[($0+1)%4]) })
            draft = try SavedFloorPlan(name:strings.text("defaultRoom"),localProject:"",plan:plan,ownerID:accountID,locationID:selectedLocation?.id)
            name = strings.text("defaultRoom")
        } catch { notice = "invalidDimensions" }
    }
    var canExportModel: Bool { draft?.plan.source == .sensor }
    func finishedSharing() { if let share { PlanExports.clean(share) }; share = nil }
}
