import Foundation

public struct WorkplaceLocation: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let title: String
    public let city: String
}
public struct WorkplaceAccount: Codable, Equatable, Sendable {
    public let accountID: String
    public let locations: [WorkplaceLocation]
    public let limited: Bool
    public func validate() throws {
        guard accountID.range(of: "^user_[a-zA-Z0-9]{1,128}$", options: .regularExpression) != nil,
              locations.count <= 200, Set(locations.map(\.id)).count == locations.count,
              locations.allSatisfy({ !$0.title.isEmpty && $0.title.count <= 200 && $0.city.count <= 320 }) else { throw PlanError.invalidArchive }
    }
    public func permits(_ record: SavedFloorPlan) -> Bool {
        record.ownerID == accountID && locations.contains { $0.id == record.locationID }
    }
}

public enum PlanObjectKind: String, Codable, CaseIterable, Sendable {
    case table, chair, sofa, bed, cabinet, outlet, threePhaseOutlet, lightSwitch, fuseBox, coldWater, hotWater, drain, sink, toilet, camera, filmLight
    public var group: String {
        switch self {
        case .table, .chair, .sofa, .bed, .cabinet: return "furniture"
        case .outlet, .threePhaseOutlet, .lightSwitch, .fuseBox: return "power"
        case .coldWater, .hotWater, .drain, .sink, .toilet: return "water"
        case .camera, .filmLight: return "film"
        }
    }
    public var dimensions: (Double, Double) {
        switch self {
        case .table: return (1.6, 0.8)
        case .chair: return (0.5, 0.5)
        case .sofa: return (2.0, 0.9)
        case .bed: return (1.6, 2.0)
        case .cabinet: return (1.0, 0.6)
        case .sink: return (0.6, 0.5)
        case .toilet: return (0.4, 0.7)
        case .camera, .filmLight: return (0.6, 0.6)
        default: return (0.2, 0.2) // Plan markers, not surveyed installation sizes.
        }
    }
    public var symbol: String {
        switch self {
        case .table: return "table.furniture"
        case .chair: return "chair"
        case .sofa: return "sofa"
        case .bed: return "bed.double"
        case .cabinet: return "cabinet"
        case .outlet, .threePhaseOutlet: return "powerplug"
        case .lightSwitch: return "switch.2"
        case .fuseBox: return "bolt.square"
        case .coldWater, .hotWater: return "drop"
        case .drain: return "arrow.down.circle"
        case .sink: return "sink"
        case .toilet: return "toilet"
        case .camera: return "video"
        case .filmLight: return "light.max"
        }
    }
}
public struct PlanObject: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var kind: PlanObjectKind
    public var center: PlanPoint
    public var width: Double
    public var depth: Double
    public var rotation: Double
    public var label: String
    public var note: String
    public init(id: UUID = UUID(), kind: PlanObjectKind, center: PlanPoint) {
        self.id = id; self.kind = kind; self.center = center
        (width, depth) = kind.dimensions; rotation = 0; label = ""; note = ""
    }
    public var valid: Bool {
        center.valid && width.isFinite && depth.isFinite && rotation.isFinite
        && (0.05...100).contains(width) && (0.05...100).contains(depth)
        && abs(rotation) <= 36000 && label.count <= 100 && note.count <= 500
    }
    public var corners: [PlanPoint] {
        let r = rotation * .pi / 180
        return [(-1.0,-1.0),(1,-1),(1,1),(-1,1)].map { x,z in
            let a = x * width/2, b = z * depth/2
            return PlanPoint(center.x + a*cos(r)-b*sin(r), center.z + a*sin(r)+b*cos(r))
        }
    }
}

/// View state only. Panning and zooming never change metre-based source geometry.
public struct PlanViewport: Equatable, Sendable {
    public var zoom = 1.0
    public var rotation = 0.0
    public var offset = PlanPoint(0, 0)
    public init() {}
}
public struct PlanTransform: Sendable {
    public let center: PlanPoint
    public let scale: Double
    public let origin: PlanPoint
    public let rotation: Double
    public init(plan: FloorPlan, width: Double, height: Double, viewport: PlanViewport = PlanViewport(), extraPoints: [PlanPoint] = []) {
        let angle = viewport.rotation
        rotation = angle
        let extra = extraPoints.map { $0.rotated(angle) }
        let points = plan.drawingPoints(rotation: rotation) + extra
        let minX = points.map(\.x).min() ?? 0, maxX = points.map(\.x).max() ?? 1
        let minZ = points.map(\.z).min() ?? 0, maxZ = points.map(\.z).max() ?? 1
        center = PlanPoint((minX+maxX)/2, (minZ+maxZ)/2)
        scale = max(0.001, min((width-76)/max(0.1,maxX-minX), (height-76)/max(0.1,maxZ-minZ))) * min(8, max(0.3, viewport.zoom))
        origin = PlanPoint(width/2 + viewport.offset.x, height/2 + viewport.offset.z)
    }
    public func screen(_ p: PlanPoint) -> PlanPoint {
        PlanPoint(origin.x + (p.x*cos(rotation)-p.z*sin(rotation)-center.x)*scale,
                  origin.z + (p.x*sin(rotation)+p.z*cos(rotation)-center.z)*scale)
    }
    public func world(_ p: PlanPoint) -> PlanPoint {
        let x = (p.x-origin.x)/scale+center.x, z = (p.z-origin.z)/scale+center.z
        return PlanPoint(x*cos(rotation)+z*sin(rotation), -x*sin(rotation)+z*cos(rotation))
    }
}

public struct PlanEditHistory {
    public private(set) var objects: [PlanObject] = []
    private var past: [[PlanObject]] = []
    private var future: [[PlanObject]] = []
    public init(_ objects: [PlanObject] = []) { self.objects = objects }
    public var canUndo: Bool { !past.isEmpty }
    public var canRedo: Bool { !future.isEmpty }
    public mutating func apply(_ value: [PlanObject]) throws {
        guard value.count <= 200, value.allSatisfy(\.valid), Set(value.map(\.id)).count == value.count else { throw PlanError.invalidGeometry }
        guard objects != value else { return }
        past.append(objects); if past.count > 50 { past.removeFirst() }
        future = []; objects = value
    }
    public mutating func undo() { if let value = past.popLast() { future.append(objects); objects = value } }
    public mutating func redo() { if let value = future.popLast() { past.append(objects); objects = value } }
}
