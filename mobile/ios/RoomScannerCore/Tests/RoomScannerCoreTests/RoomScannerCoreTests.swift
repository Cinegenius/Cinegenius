import XCTest
@testable import RoomScannerCore

final class RoomScannerCoreTests: XCTestCase {
    func testRotatedSurfaceUsesLocalXAxisAndTrueLength() throws {
        let axis = PlanPoint(cos(.pi/4),sin(.pi/4))
        let s = try PlanSegment.projected(kind:.wall,center:PlanPoint(3,8),axis:axis,width:4)
        XCTAssertEqual(s.length,4,accuracy:0.000001)
        XCTAssertEqual(s.start.x,3-sqrt(2),accuracy:0.000001)
        XCTAssertEqual(s.end.z,8+sqrt(2),accuracy:0.000001)
    }
    func testWorldZWallAndReverseAxis() throws {
        let s = try PlanSegment.projected(kind:.wall,center:PlanPoint(2,-1),axis:PlanPoint(0,-1),width:5)
        XCTAssertEqual(s.start,PlanPoint(2,1.5)); XCTAssertEqual(s.end,PlanPoint(2,-3.5))
    }
    func testOpenPlanIsValidWithoutInventingClosingWall() throws {
        let walls = [PlanSegment(kind:.wall,start:PlanPoint(0,0),end:PlanPoint(5,0)),PlanSegment(kind:.wall,start:PlanPoint(5,0),end:PlanPoint(5,2))]
        let p = try FloorPlan(source:.sensor,segments:walls)
        XCTAssertEqual(p.walls.count,2); XCTAssertEqual(p.segments,walls)
    }
    func testRejectsNonFiniteAndDegenerateSurfaces() {
        for width in [0,-1,Double.infinity,Double.nan,1001] {
            XCTAssertThrowsError(try PlanSegment.projected(kind:.wall,center:PlanPoint(0,0),axis:PlanPoint(1,0),width:width))
        }
        XCTAssertThrowsError(try PlanSegment.projected(kind:.wall,center:PlanPoint(.nan,0),axis:PlanPoint(1,0),width:4))
        XCTAssertThrowsError(try PlanSegment.projected(kind:.wall,center:PlanPoint(0,0),axis:PlanPoint(0,0),width:4))
        XCTAssertThrowsError(try FloorPlan(source:.sensor,segments:[]))
        XCTAssertThrowsError(try FloorPlan(source:.sensor,segments:[PlanSegment(kind:.door,start:PlanPoint(0,0),end:PlanPoint(1,0))]))
    }
    func testDuplicateGeometryIDsAreRejected() {
        let s = PlanSegment(kind:.wall,start:PlanPoint(0,0),end:PlanPoint(1,0))
        XCTAssertThrowsError(try FloorPlan(source:.sensor,segments:[s,s]))
    }
    func testExampleTagSurvivesRenameAndArchiveRoundTrip() throws {
        let record = try SavedFloorPlan(name:"Anything",localProject:"Local only",plan:.example)
        let decoded = try JSONDecoder().decode(SavedFloorPlan.self,from:JSONEncoder().encode(record))
        XCTAssertEqual(decoded.plan.source,.example)
        XCTAssertThrowsError(try SavedFloorPlan(name:"Demo",localProject:"",plan:.example,capturedRoomData:Data([1,2])))
    }
    func testNameValidationAndLegacySourceCompatibility() throws {
        XCTAssertThrowsError(try SavedFloorPlan(name:"   ",localProject:"",plan:.example))
        XCTAssertThrowsError(try SavedFloorPlan(name:String(repeating:"x",count:101),localProject:"",plan:.example))
        let record = try SavedFloorPlan(name:"  Room  ",localProject:"  Project  ",plan:.example)
        XCTAssertEqual(record.name,"Room");XCTAssertEqual(record.localProject,"Project")
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(record)) as? [String:Any])
        object.removeValue(forKey:"capturedRoomData")
        let old = try JSONDecoder().decode(SavedFloorPlan.self,from:JSONSerialization.data(withJSONObject:object))
        XCTAssertNil(old.capturedRoomData)
    }
    private func directory() throws -> URL {
        let p = FileManager.default.temporaryDirectory.appendingPathComponent("CineGeniusCoreTests-"+UUID().uuidString)
        try FileManager.default.createDirectory(at:p,withIntermediateDirectories:false)
        addTeardownBlock { try? FileManager.default.removeItem(at:p) }; return p
    }
    func testAtomicIdempotentSaveAndConflictKeepLastValidFile() async throws {
        let root = try directory();let store = PlanArchive(root:root)
        let p = try SavedFloorPlan(name:"Room",localProject:"",plan:.example)
        try await store.save(p)
        let url = root.appendingPathComponent(p.id.uuidString+".json")
        let original = try Data(contentsOf:url)
        try await store.save(p);XCTAssertEqual(try Data(contentsOf:url),original)
        let changed = try SavedFloorPlan(id:p.id,createdAt:p.createdAt,name:"Changed",localProject:"",plan:p.plan)
        do { try await store.save(changed);XCTFail("Must reject conflicting overwrite") } catch { XCTAssertEqual(error as? PlanError,.conflict) }
        XCTAssertEqual(try Data(contentsOf:url),original)
        let list = try await store.list();XCTAssertEqual(list,[p])
    }
    func testWriteFailurePreservesPreviousArchiveAndCurrentValue() async throws {
        let root = try directory();let store = PlanArchive(root:root)
        let old = try SavedFloorPlan(name:"Valid",localProject:"",plan:.example)
        try await store.save(old)
        let broken = PlanArchive(root:root,writer:{ _,_ in throw CocoaError(.fileWriteOutOfSpace) })
        let draft = try SavedFloorPlan(name:"Unsaved",localProject:"Local",plan:.example)
        do { try await broken.save(draft);XCTFail("Must surface write failure") } catch {}
        let list = try await store.list();XCTAssertEqual(list,[old]);XCTAssertEqual(draft.name,"Unsaved")
    }
    func testCorruptArchiveIsReportedAndNeverRemoved() async throws {
        let root = try directory();let store = PlanArchive(root:root)
        let good = try SavedFloorPlan(name:"Valid",localProject:"",plan:.example);try await store.save(good)
        let corrupt = root.appendingPathComponent(UUID().uuidString+".json");let bytes = Data("broken-json".utf8);try bytes.write(to:corrupt)
        do { _ = try await store.list();XCTFail("Must report corruption") } catch {}
        XCTAssertEqual(try Data(contentsOf:corrupt),bytes)
        XCTAssertTrue(FileManager.default.fileExists(atPath:root.appendingPathComponent(good.id.uuidString+".json").path))
    }
    func testArchiveUsesPrivatePermissionsAndBackupExclusion() async throws {
        let root = try directory();let store = PlanArchive(root:root)
        let p = try SavedFloorPlan(name:"Private example",localProject:"",plan:.example);try await store.save(p)
        let file = root.appendingPathComponent(p.id.uuidString+".json")
        #if !os(Linux) // Linux Foundation has no Apple backup-exclusion metadata.
        XCTAssertEqual(try root.resourceValues(forKeys:[.isExcludedFromBackupKey]).isExcludedFromBackup,true)
        XCTAssertEqual(try file.resourceValues(forKeys:[.isExcludedFromBackupKey]).isExcludedFromBackup,true)
        #endif
        XCTAssertEqual((try FileManager.default.attributesOfItem(atPath:file.path)[.posixPermissions] as? NSNumber)?.intValue,0o600)
        XCTAssertEqual((try FileManager.default.attributesOfItem(atPath:root.path)[.posixPermissions] as? NSNumber)?.intValue,0o700)
    }
    func testOriginalCapturedSourcePersistsInSameAtomicFile() async throws {
        let root = try directory();let store = PlanArchive(root:root)
        let plan = try FloorPlan(source:.sensor,segments:[PlanSegment(kind:.wall,start:PlanPoint(0,0),end:PlanPoint(3,4))])
        let bytes = Data("opaque RoomPlan Codable test source".utf8)
        let p = try SavedFloorPlan(name:"Real",localProject:"",plan:plan,capturedRoomData:bytes);try await store.save(p)
        let loaded = try await store.list();XCTAssertEqual(loaded.first?.capturedRoomData,bytes)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath:root.path).count,1)
    }
    func testSaveSucceededWithoutUIAckThenRetryUsesStableSourceBytes() async throws {
        let store = PlanArchive(root:try directory())
        let p = try FloorPlan(source:.sensor,segments:[PlanSegment(kind:.wall,start:PlanPoint(0,0),end:PlanPoint(4,0))])
        let source1 = try CapturedSourceEncoding.encode(["walls":1,"objects":2])
        let source2 = try CapturedSourceEncoding.encode(["objects":2,"walls":1])
        XCTAssertEqual(source1,source2)
        let first = try SavedFloorPlan(name:"Pending acknowledgement",localProject:"",plan:p,capturedRoomData:source1)
        try await store.save(first) // Commit succeeded; simulate background before UI acknowledgement.
        let retry = try SavedFloorPlan(id:first.id,createdAt:first.createdAt,name:first.name,localProject:first.localProject,plan:p,capturedRoomData:source2)
        try await store.save(retry)
        let records = try await store.list();XCTAssertEqual(records,[first])
    }
    func testOriginGateChecksEveryOriginAndFrame() throws {
        let url = URL(string:"https://www.cinegenius.co/locations")!
        let gate = try XCTUnwrap(WorkplaceOriginPolicy(configured:URL(string:"https://www.cinegenius.co/")!))
        func allows(_ request: URL?,_ current: URL?,_ main: Bool = true,_ host: String = "www.cinegenius.co",_ port: Int = 443) -> Bool { gate.permits(mainFrame:main,request:request,current:current,securityScheme:"https",securityHost:host,securityPort:port) }
        XCTAssertTrue(allows(url,url));XCTAssertFalse(allows(url,url,false))
        XCTAssertFalse(allows(URL(string:"https://www.cinegenius.co.evil/"),url))
        XCTAssertFalse(allows(url,URL(string:"http://www.cinegenius.co/")))
        XCTAssertFalse(allows(url,url,true,"evil"));XCTAssertFalse(allows(url,url,true,"www.cinegenius.co",8443))
        XCTAssertFalse(allows(nil,url));XCTAssertNil(WorkplaceOriginPolicy(configured:URL(string:"https://evil/")!))
    }
    func testLocalPreviewGateStillRequiresExactConfiguredPort() throws {
        let gate = try XCTUnwrap(WorkplaceOriginPolicy(configured:URL(string:"http://localhost:3010/")!))
        XCTAssertTrue(gate.permits(mainFrame:true,request:URL(string:"http://localhost:3010/a"),current:URL(string:"http://localhost:3010/b"),securityScheme:"http",securityHost:"localhost",securityPort:3010))
        XCTAssertFalse(gate.permits(mainFrame:true,request:URL(string:"http://localhost:3000/"),current:URL(string:"http://localhost:3010/"),securityScheme:"http",securityHost:"localhost",securityPort:3010))
    }
}
