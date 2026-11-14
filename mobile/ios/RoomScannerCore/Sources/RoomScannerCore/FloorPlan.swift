import Foundation

public enum PlanError: Error, Equatable { case invalidGeometry, invalidName, invalidArchive, conflict }
public enum CapturedSourceEncoding {
    public static func encode<T: Encodable>(_ source: T) throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(source)
    }
}
public struct PlanPoint: Codable, Equatable, Sendable {
    public var x: Double
    public var z: Double
    public init(_ x: Double, _ z: Double) { self.x = x; self.z = z }
    public func rotated(_ angle: Double) -> PlanPoint {
        let c: Double = cos(angle), s: Double = sin(angle)
        let px: Double = x*c - z*s
        let pz: Double = x*s + z*c
        return PlanPoint(px,pz)
    }
    public var valid: Bool { x.isFinite && z.isFinite && abs(x) <= 10_000 && abs(z) <= 10_000 }
}
public struct PlanSegment: Codable, Equatable, Identifiable, Sendable {
    public enum Kind: String, Codable, Sendable { case wall, door, window, opening }
    public let id: UUID
    public let kind: Kind
    public let start: PlanPoint
    public let end: PlanPoint
    public init(id: UUID = UUID(), kind: Kind, start: PlanPoint, end: PlanPoint) { self.id = id; self.kind = kind; self.start = start; self.end = end }
    public var length: Double { hypot(end.x - start.x, end.z - start.z) }
    // RoomPlan surfaces extend along their transformed local X axis, not world X.
    public static func projected(id: UUID = UUID(), kind: Kind, center: PlanPoint, axis: PlanPoint, width: Double) throws -> PlanSegment {
        guard center.valid, axis.valid, width.isFinite, width > 0, width <= 1000 else { throw PlanError.invalidGeometry }
        let s = PlanSegment(id: id, kind: kind, start: PlanPoint(center.x - axis.x * width / 2, center.z - axis.z * width / 2), end: PlanPoint(center.x + axis.x * width / 2, center.z + axis.z * width / 2))
        guard s.valid else { throw PlanError.invalidGeometry }; return s
    }
    public var valid: Bool { start.valid && end.valid && length.isFinite && length >= 0.01 && length <= 1000 }
}
public struct FloorPlan: Codable, Equatable, Sendable {
    public enum Source: String, Codable, Sendable { case sensor, example, manual }
    public let source: Source
    public let segments: [PlanSegment]
    public init(source: Source, segments: [PlanSegment]) throws { self.source = source; self.segments = segments; try validate() }
    public var walls: [PlanSegment] { segments.filter { $0.kind == .wall } }
    public func validate() throws {
        guard !walls.isEmpty, segments.count <= 10_000, segments.allSatisfy(\.valid), Set(segments.map(\.id)).count == segments.count else { throw PlanError.invalidGeometry }
    }
    // Bounds are drawing bounds only. No area or closed-room claim is inferred.
    public func drawingPoints(rotation: Double = 0) -> [PlanPoint] {
        let points: [PlanPoint] = segments.flatMap { [$0.start, $0.end] }
        return points.map { $0.rotated(rotation) }
    }
    public static var example: FloorPlan {
        let points = [PlanPoint(0,0), PlanPoint(4.5,0), PlanPoint(4.5,3.2), PlanPoint(2.7,4.4), PlanPoint(0,4.4)]
        var lines = points.indices.map { PlanSegment(kind: .wall, start: points[$0], end: points[($0 + 1) % points.count]) }
        lines += [PlanSegment(kind: .door, start: PlanPoint(0.5,0), end: PlanPoint(1.4,0)), PlanSegment(kind: .window, start: PlanPoint(4.5,0.7), end: PlanPoint(4.5,2.1)), PlanSegment(kind: .opening, start: PlanPoint(0,1), end: PlanPoint(0,2.1))]
        return try! FloorPlan(source: .example, segments: lines)
    }
}
public struct SavedFloorPlan: Codable, Equatable, Identifiable, Sendable {
    public let schemaVersion: Int
    public let id: UUID
    public let createdAt: Date
    public let name: String
    public let localProject: String
    public let plan: FloorPlan
    public let capturedRoomData: Data?
    public let ownerID: String?
    public let locationID: UUID?
    public let revision: Int
    public let objects: [PlanObject]
    public init(id: UUID = UUID(), createdAt: Date = Date(), name: String, localProject: String, plan: FloorPlan, capturedRoomData: Data? = nil, ownerID: String? = nil, locationID: UUID? = nil, revision: Int = 0, objects: [PlanObject] = []) throws {
        schemaVersion = 2; self.id = id; self.createdAt = createdAt
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        self.localProject = localProject.trimmingCharacters(in: .whitespacesAndNewlines)
        self.plan = plan; self.capturedRoomData = capturedRoomData
        self.ownerID = ownerID; self.locationID = locationID; self.revision = revision; self.objects = objects
        try validate()
    }
    private enum CodingKeys: String, CodingKey { case schemaVersion, id, createdAt, name, localProject, plan, capturedRoomData, ownerID, locationID, revision, objects }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try c.decode(Int.self, forKey: .schemaVersion)
        id = try c.decode(UUID.self, forKey: .id); createdAt = try c.decode(Date.self, forKey: .createdAt)
        name = try c.decode(String.self, forKey: .name); localProject = try c.decode(String.self, forKey: .localProject)
        plan = try c.decode(FloorPlan.self, forKey: .plan); capturedRoomData = try c.decodeIfPresent(Data.self, forKey: .capturedRoomData)
        ownerID = try c.decodeIfPresent(String.self, forKey: .ownerID); locationID = try c.decodeIfPresent(UUID.self, forKey: .locationID)
        revision = schemaVersion == 1 ? 0 : try c.decode(Int.self, forKey: .revision)
        objects = schemaVersion == 1 ? [] : try c.decode([PlanObject].self, forKey: .objects)
        try validate()
    }
    public func validate() throws {
        guard [1,2].contains(schemaVersion), createdAt.timeIntervalSince1970.isFinite, revision >= 0, revision < Int.max else { throw PlanError.invalidArchive }
        guard !name.isEmpty, name.count <= 100, localProject.count <= 100 else { throw PlanError.invalidName }
        guard (ownerID == nil) == (locationID == nil), ownerID == nil || ownerID!.range(of: "^user_[a-zA-Z0-9]{1,128}$", options: .regularExpression) != nil else { throw PlanError.invalidArchive }
        guard objects.count <= 200, objects.allSatisfy(\.valid), Set(objects.map(\.id)).count == objects.count else { throw PlanError.invalidGeometry }
        if let data = capturedRoomData { guard plan.source == .sensor, !data.isEmpty, data.count <= 32_000_000 else { throw PlanError.invalidArchive } }
        try plan.validate()
    }
    public func hasSameSource(as other: SavedFloorPlan) -> Bool {
        id == other.id && createdAt == other.createdAt && plan == other.plan && capturedRoomData == other.capturedRoomData && ownerID == other.ownerID && locationID == other.locationID
    }
    /// Called only after an explicit on-device choice. Keep identity and source
    /// bytes stable so a lost acknowledgement can be retried without duplicates.
    public func assigningLegacy(to account: WorkplaceAccount, locationID: UUID) throws -> SavedFloorPlan {
        try validate(); try account.validate()
        guard ownerID == nil, self.locationID == nil,
              account.locations.contains(where: { $0.id == locationID }) else { throw PlanError.invalidArchive }
        return try SavedFloorPlan(id:id,createdAt:createdAt,name:name,localProject:localProject,
                                  plan:plan,capturedRoomData:capturedRoomData,ownerID:account.accountID,
                                  locationID:locationID,objects:objects)
    }
}
