import UIKit
import SwiftUI
import RoomPlan

struct PlanShare: Identifiable { let id = UUID(); let url: URL }
enum PlanExports {
    private static var root: URL { FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("NativeRoomScannerExports",isDirectory:true) }
    static func removeStaleExports() { if FileManager.default.fileExists(atPath:root.path) { try? FileManager.default.removeItem(at:root) } }
    private static func destination(_ name: String) throws -> URL {
        try PrivatePlanFiles.directory(root)
        let directory = root.appendingPathComponent(UUID().uuidString,isDirectory:true)
        try PrivatePlanFiles.directory(directory)
        return directory.appendingPathComponent(name)
    }
    static func pdf(_ record: SavedFloorPlan, strings: ScannerStrings) throws -> PlanShare {
        let url = try destination(record.plan.source == .example ? "example-floor-plan.pdf" : "floor-plan.pdf")
        do { try PrivatePlanFiles.write(PlanPDF.data(record:record,strings:strings),to:url); return PlanShare(url:url) }
        catch { try? FileManager.default.removeItem(at:url.deletingLastPathComponent()); throw error }
    }
    @available(iOS 16.0, *) static func model(_ room: CapturedRoom) throws -> PlanShare {
        let url = try destination("room.usdz")
        do { try room.export(to:url,exportOptions:.parametric); try PrivatePlanFiles.protect(url); return PlanShare(url:url) }
        catch { try? FileManager.default.removeItem(at:url.deletingLastPathComponent()); throw error }
    }
    static func clean(_ share: PlanShare) {
        let directory = share.url.deletingLastPathComponent()
        guard directory.deletingLastPathComponent().standardizedFileURL == root.standardizedFileURL else { return }
        try? FileManager.default.removeItem(at:directory)
    }
}
struct PlanShareSheet: UIViewControllerRepresentable {
    let share: PlanShare
    let completion: () -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems:[share.url],applicationActivities:nil)
        controller.completionWithItemsHandler = { _,_,_,_ in completion() }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
