import Foundation
import Combine

final class ScannerStrings: ObservableObject {
    struct Catalog: Decodable { let defaultLocale: String; let supportedLocales: [String] }
    @Published private(set) var locale: String
    private var values: [String: String] = [:]
    let catalog: Catalog
    private let root: URL
    init(preference: String? = nil) {
        root = Bundle.main.resourceURL!.appendingPathComponent("public/native-room-scanner")
        catalog = (try? JSONDecoder().decode(Catalog.self, from: Data(contentsOf: root.appendingPathComponent("locales.json")))) ?? Catalog(defaultLocale: "de", supportedLocales: ["de"])
        locale = catalog.defaultLocale
        select(preference: preference)
    }
    func valid(_ value: String) -> String? {
        catalog.supportedLocales.first { $0.caseInsensitiveCompare(value.replacingOccurrences(of: "_", with: "-")) == .orderedSame }
    }
    func select(preference: String?) {
        let device = Locale.preferredLanguages.compactMap { value in valid(value) ?? valid(String(value.split(separator: "-").first ?? "")) }.first
        let selected = preference.flatMap(valid) ?? device ?? catalog.defaultLocale
        let base = (try? JSONDecoder().decode([String: String].self, from: Data(contentsOf: root.appendingPathComponent(catalog.defaultLocale + ".json")))) ?? [:]
        let current = (try? JSONDecoder().decode([String: String].self, from: Data(contentsOf: root.appendingPathComponent(selected + ".json")))) ?? [:]
        values = base.merging(current) { _, new in new }; locale = selected
    }
    func text(_ key: String, _ arguments: [String: String] = [:]) -> String {
        arguments.reduce(values[key] ?? "[\(key)]") { result, pair in result.replacingOccurrences(of: "{\(pair.key)}", with: pair.value) }
    }
    func number(_ value: Double) -> String {
        let formatter = NumberFormatter(); formatter.locale = Locale(identifier: locale); formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "—"
    }
    func parseNumber(_ text: String) -> Double? {
        let value = text.trimmingCharacters(in:.whitespacesAndNewlines)
        let formatter = NumberFormatter(); formatter.locale = Locale(identifier:locale); formatter.numberStyle = .decimal; formatter.isLenient = false
        let separator = formatter.decimalSeparator ?? "."
        let pattern = "^-?[0-9]+(?:" + NSRegularExpression.escapedPattern(for:separator) + "[0-9]+)?$"
        guard value.range(of:pattern,options:.regularExpression) != nil else { return nil }
        return formatter.number(from:value)?.doubleValue
    }
    func summary(_ plan: FloorPlan) -> String {
        let counts = [("walls", PlanSegment.Kind.wall), ("doors", .door), ("windows", .window), ("openings", .opening)].map { key, kind in (key, String(plan.segments.filter { $0.kind == kind }.count)) }
        return text("planSummary", Dictionary(uniqueKeysWithValues: counts))
    }
}
