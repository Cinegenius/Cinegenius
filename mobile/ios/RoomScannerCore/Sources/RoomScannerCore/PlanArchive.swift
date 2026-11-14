import Foundation

public enum PrivatePlanFiles {
    public static func protect(_ url: URL, directory: Bool = false) throws {
        let fm = FileManager.default
        var attrs: [FileAttributeKey: Any] = [.posixPermissions: directory ? 0o700 : 0o600]
        #if os(iOS)
        attrs[.protectionKey] = FileProtectionType.complete
        #endif
        try fm.setAttributes(attrs, ofItemAtPath: url.path)
        var mutable = url
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try mutable.setResourceValues(values)
    }
    public static func directory(_ url: URL) throws {
        if FileManager.default.fileExists(atPath: url.path), try url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true { throw PlanError.invalidArchive }
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try protect(url, directory: true)
    }
    public static func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: url, options: .atomic)
        #endif
        try protect(url)
    }
}
public actor PlanArchive {
    public typealias Writer = @Sendable (Data, URL) throws -> Void
    public let root: URL
    private let writer: Writer
    public init(root: URL, writer: @escaping Writer = { try PrivatePlanFiles.write($0, to: $1) }) { self.root = root; self.writer = writer }
    private func file(_ id: UUID) -> URL { root.appendingPathComponent(id.uuidString + ".json") }
    private func read(_ url: URL) throws -> SavedFloorPlan {
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true, (values.fileSize ?? Int.max) <= 64_000_000 else { throw PlanError.invalidArchive }
        let plan = try JSONDecoder().decode(SavedFloorPlan.self, from: Data(contentsOf: url))
        try plan.validate()
        guard file(plan.id).lastPathComponent == url.lastPathComponent else { throw PlanError.invalidArchive }
        return plan
    }
    public func list() throws -> [SavedFloorPlan] {
        try PrivatePlanFiles.directory(root)
        let urls = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }
        guard urls.count <= 10_000 else { throw PlanError.invalidArchive }
        return try urls.map(read).sorted { $0.createdAt > $1.createdAt }
    }
    public func save(_ plan: SavedFloorPlan) throws {
        try plan.validate(); try PrivatePlanFiles.directory(root)
        let url = file(plan.id)
        if FileManager.default.fileExists(atPath: url.path) {
            guard try read(url) == plan else { throw PlanError.conflict }
            try PrivatePlanFiles.protect(url); return
        }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        // One atomically committed file: no index or secondary asset can get out of sync.
        try writer(encoder.encode(plan), url)
    }
    public func update(_ record: SavedFloorPlan, replacing expected: SavedFloorPlan) throws {
        try record.validate(); try expected.validate(); try PrivatePlanFiles.directory(root)
        guard record.hasSameSource(as: expected), record.revision == expected.revision + 1 else { throw PlanError.conflict }
        let url = file(record.id)
        let current = try read(url)
        if current == record { try PrivatePlanFiles.protect(url); return }
        guard current == expected else { throw PlanError.conflict }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        try writer(encoder.encode(record), url)
    }
    public func delete(id: UUID) throws {
        let url = file(id)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
}
