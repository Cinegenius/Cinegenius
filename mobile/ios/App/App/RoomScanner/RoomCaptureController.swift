import UIKit
import SwiftUI
import RoomPlan

@available(iOS 16.0, *)
final class NativeRoomCaptureController: UIViewController, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
    let captureView = RoomCaptureView(frame: .zero)
    var onResult: ((Result<(FloorPlan, CapturedRoom), Error>) -> Void)?
    private var accepting = true
    private var finishing = false
    override func viewDidLoad() {
        super.viewDidLoad()
        view = captureView
        captureView.delegate = self; captureView.captureSession.delegate = self
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }
    func finish() { guard accepting, !finishing else { return }; finishing = true; captureView.captureSession.stop() }
    func cancel() { accepting = false; captureView.captureSession.stop(); captureView.delegate = nil; captureView.captureSession.delegate = nil }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); if !finishing { cancel() } }
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        guard accepting else { return false }
        if let error { accepting = false; onResult?(.failure(error)); return false }
        return finishing
    }
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        guard accepting, finishing else { return }; accepting = false
        if let error { onResult?(.failure(error)); return }
        do { onResult?(.success((try Self.project(processedResult), processedResult))) } catch { onResult?(.failure(error)) }
    }
    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        guard accepting else { return }
        if let error { accepting = false; onResult?(.failure(error)) }
    }
    static func project(_ room: CapturedRoom) throws -> FloorPlan {
        var segments: [PlanSegment] = []
        for (surfaces, kind) in [(room.walls, PlanSegment.Kind.wall), (room.doors, .door), (room.windows, .window), (room.openings, .opening)] {
            for surface in surfaces {
                // A curved surface must never be presented as a straight measured wall.
                guard surface.curve == nil else { throw PlanError.invalidGeometry }
                let t = surface.transform
                guard [t.columns.0, t.columns.1, t.columns.2, t.columns.3].allSatisfy({ [$0.x,$0.y,$0.z,$0.w].allSatisfy(\.isFinite) }) else { throw PlanError.invalidGeometry }
                segments.append(try .projected(id: surface.identifier, kind: kind, center: PlanPoint(Double(t.columns.3.x), Double(t.columns.3.z)), axis: PlanPoint(Double(t.columns.0.x), Double(t.columns.0.z)), width: Double(surface.dimensions.x)))
            }
        }
        return try FloorPlan(source: .sensor, segments: segments)
    }
}
@available(iOS 16.0, *)
struct RoomCaptureSurface: UIViewControllerRepresentable {
    let controller: NativeRoomCaptureController
    func makeUIViewController(context: Context) -> NativeRoomCaptureController { controller }
    func updateUIViewController(_ uiViewController: NativeRoomCaptureController, context: Context) {}
    static func dismantleUIViewController(_ uiViewController: NativeRoomCaptureController, coordinator: ()) { uiViewController.cancel() }
}
