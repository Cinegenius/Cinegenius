import Foundation

public struct WorkplaceOriginPolicy {
    private let scheme: String
    private let host: String
    private let port: Int
    public init?(configured: URL) {
        guard configured.user == nil, configured.password == nil, let scheme = configured.scheme, let host = configured.host else { return nil }
        let port = configured.port ?? (scheme == "https" ? 443 : 80)
        let production = scheme == "https" && host == "www.cinegenius.co" && port == 443
        let local = scheme == "http" && ["localhost","127.0.0.1","10.0.2.2"].contains(host) && configured.port != nil
        guard production || local else { return nil }
        self.scheme = scheme; self.host = host; self.port = port
    }
    public func permits(mainFrame: Bool, request: URL?, current: URL?, securityScheme: String, securityHost: String, securityPort: Int) -> Bool {
        func matches(_ url: URL?) -> Bool {
            guard let url else { return false }
            return url.user == nil && url.password == nil && url.scheme == scheme && url.host == host && (url.port ?? (scheme == "https" ? 443 : 80)) == port
        }
        return mainFrame && matches(request) && matches(current) && securityScheme == scheme && securityHost == host && (securityPort == 0 ? (scheme == "https" ? 443 : 80) : securityPort) == port
    }
}

public enum AppAuthenticationPolicy {
    public static func permitsClerkHandshake(_ url: URL, mainFrame: Bool) -> Bool {
        mainFrame && url.scheme == "https" && url.host == "clerk.cinegenius.co"
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
            && url.path == "/v1/client/handshake"
    }
}
