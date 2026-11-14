// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "RoomScannerCore", platforms: [.iOS(.v15), .macOS(.v13)], products: [.library(name: "RoomScannerCore", targets: ["RoomScannerCore"])], targets: [.target(name: "RoomScannerCore"), .testTarget(name: "RoomScannerCoreTests", dependencies: ["RoomScannerCore"])])
