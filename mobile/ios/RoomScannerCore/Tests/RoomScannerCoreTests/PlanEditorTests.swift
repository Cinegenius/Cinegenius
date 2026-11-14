import XCTest
@testable import RoomScannerCore

final class PlanEditorTests: XCTestCase {
    func testClerkHandshakeExceptionCannotBroadenNativeNavigation() throws {
        let allowed = try XCTUnwrap(URL(string:"https://clerk.cinegenius.co/v1/client/handshake?redirect_url=https%3A%2F%2Fwww.cinegenius.co%2Fdashboard"))
        XCTAssertTrue(AppAuthenticationPolicy.permitsClerkHandshake(allowed,mainFrame:true))
        XCTAssertFalse(AppAuthenticationPolicy.permitsClerkHandshake(allowed,mainFrame:false))
        for value in ["http://clerk.cinegenius.co/v1/client/handshake", "https://clerk.cinegenius.co.evil.example/v1/client/handshake", "https://clerk.cinegenius.co:8443/v1/client/handshake", "https://user@clerk.cinegenius.co/v1/client/handshake", "https://clerk.cinegenius.co/other"] {
            XCTAssertFalse(AppAuthenticationPolicy.permitsClerkHandshake(try XCTUnwrap(URL(string:value)),mainFrame:true))
        }
    }
    private func record(_ objects: [PlanObject] = []) throws -> SavedFloorPlan {
        try SavedFloorPlan(name:"Room",localProject:"Production",plan:.example,ownerID:"user_One",locationID:UUID(),objects:objects)
    }
    private func directory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at:url,withIntermediateDirectories:false)
        addTeardownBlock { try? FileManager.default.removeItem(at:url) }; return url
    }
    func testPanZoomRotationRoundTripDoesNotChangeGeometry() {
        let plan = FloorPlan.example
        for zoom in [0.3,1,8.0] {
            var viewport = PlanViewport(); viewport.zoom = zoom; viewport.rotation = .pi/3; viewport.offset = PlanPoint(120,-87)
            let transform = PlanTransform(plan:plan,width:320,height:400,viewport:viewport)
            for point in plan.drawingPoints() {
                let world = transform.world(transform.screen(point))
                XCTAssertEqual(world.x,point.x,accuracy:1e-9); XCTAssertEqual(world.z,point.z,accuracy:1e-9)
            }
        }
        XCTAssertEqual(plan.segments.count,8)
    }
    func testCatalogFootprintsAndUndoRedoAreIndependentOfOriginal() throws {
        for kind in PlanObjectKind.allCases { XCTAssertTrue(PlanObject(kind:kind,center:PlanPoint(0,0)).valid) }
        let first = PlanObject(kind:.fuseBox,center:PlanPoint(1,2))
        var history = PlanEditHistory(); try history.apply([first])
        var changed = first; changed.center = PlanPoint(3,4); changed.rotation = 90; changed.note = "Circuit A"
        try history.apply([changed]); history.undo(); XCTAssertEqual(history.objects,[first])
        history.redo(); XCTAssertEqual(history.objects,[changed])
        history.undo(); try history.apply([]); XCTAssertFalse(history.canRedo)
        XCTAssertEqual(first.center,PlanPoint(1,2))
    }
    func testInvalidEditDoesNotDestroyUndoOrCurrentObjects() throws {
        let first = PlanObject(kind:.outlet,center:PlanPoint(0,0)); var history = PlanEditHistory()
        try history.apply([first])
        var bad = first; bad.width = .nan
        XCTAssertThrowsError(try history.apply([bad])); XCTAssertEqual(history.objects,[first]); XCTAssertTrue(history.canUndo)
        XCTAssertThrowsError(try history.apply([first,first])); XCTAssertEqual(history.objects,[first])
    }
    func testOldUnassignedArchiveDecodesWithoutInventingOwnerOrObjects() throws {
        let original = try SavedFloorPlan(name:"Original",localProject:"Old label",plan:.example)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(original)) as? [String:Any])
        json["schemaVersion"] = 1; json.removeValue(forKey:"revision"); json.removeValue(forKey:"objects")
        let legacy = try JSONDecoder().decode(SavedFloorPlan.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertNil(legacy.ownerID); XCTAssertNil(legacy.locationID); XCTAssertEqual(legacy.objects,[])
        XCTAssertEqual(legacy.plan,original.plan); XCTAssertEqual(legacy.localProject,"Old label")
    }
    func testOtherAccountOrLocationCannotSelectAPlan() throws {
        let room = try record()
        let location = WorkplaceLocation(id:room.locationID!,title:"Owned",city:"")
        let owner = WorkplaceAccount(accountID:"user_One",locations:[location],limited:false)
        try owner.validate(); XCTAssertTrue(owner.permits(room))
        XCTAssertFalse(WorkplaceAccount(accountID:"user_Two",locations:[location],limited:false).permits(room))
        XCTAssertFalse(WorkplaceAccount(accountID:"user_One",locations:[],limited:false).permits(room))
        XCTAssertThrowsError(try WorkplaceAccount(accountID:"../x",locations:[],limited:false).validate())
    }
    func testAtomicUpdatesPreserveSourceAndRejectStaleRevision() async throws {
        let root = try directory(), archive = PlanArchive(root:root), first = try record()
        try await archive.save(first)
        let object = PlanObject(kind:.coldWater,center:PlanPoint(1,1))
        let changed = try SavedFloorPlan(id:first.id,createdAt:first.createdAt,name:"Kitchen",localProject:first.localProject,plan:first.plan,ownerID:first.ownerID,locationID:first.locationID,revision:1,objects:[object])
        try await archive.update(changed,replacing:first)
        try await archive.update(changed,replacing:first) // lost-ack retry is idempotent
        let current = try await archive.list(); XCTAssertEqual(current,[changed])
        let competing = try SavedFloorPlan(id:first.id,createdAt:first.createdAt,name:"Stale",localProject:first.localProject,plan:first.plan,ownerID:first.ownerID,locationID:first.locationID,revision:1)
        do { try await archive.update(competing,replacing:first); XCTFail("must conflict") } catch { XCTAssertEqual(error as? PlanError,.conflict) }
        let invalid = try SavedFloorPlan(id:first.id,createdAt:first.createdAt,name:"Other account",localProject:first.localProject,plan:first.plan,ownerID:"user_Two",locationID:first.locationID,revision:2)
        do { try await archive.update(invalid,replacing:changed); XCTFail("cannot reassign source") } catch { XCTAssertEqual(error as? PlanError,.conflict) }
        let after = try await archive.list(); XCTAssertEqual(after,[changed])
    }
    func testFailedWriteLeavesSavedRoomAndOtherRoomsIntact() async throws {
        let root = try directory(), store = PlanArchive(root:root), first = try record(), second = try record()
        try await store.save(first); try await store.save(second)
        let failed = PlanArchive(root:root,writer:{ _,_ in throw CocoaError(.fileWriteOutOfSpace) })
        let edit = try SavedFloorPlan(id:first.id,createdAt:first.createdAt,name:"Failed edit",localProject:first.localProject,plan:first.plan,ownerID:first.ownerID,locationID:first.locationID,revision:1)
        do { try await failed.update(edit,replacing:first); XCTFail("must fail") } catch {}
        let remaining = try await store.list(); XCTAssertEqual(Set(remaining.map(\.id)),[first.id,second.id]); XCTAssertTrue(remaining.contains(first)); XCTAssertTrue(remaining.contains(second))
    }
}
