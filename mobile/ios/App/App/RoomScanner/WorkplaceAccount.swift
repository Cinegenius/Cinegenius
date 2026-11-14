import UIKit
import WebKit
import Capacitor

enum WorkplaceAccessError: String, Error { case signInRequired, accountChanged, accountUnavailable }

/// Keep Clerk's first-party cookie handshake in the same persistent web view.
/// Forward every other navigation decision and lifecycle event to Capacitor.
final class CineGeniusNavigationDelegate: NSObject, WKNavigationDelegate {
    let original: WKNavigationDelegate
    init(original: WKNavigationDelegate) { self.original = original }
    override func responds(to selector: Selector!) -> Bool { super.responds(to: selector) || original.responds(to: selector) }
    override func forwardingTarget(for selector: Selector!) -> Any? { original.responds(to: selector) ? original : super.forwardingTarget(for: selector) }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, AppAuthenticationPolicy.permitsClerkHandshake(url, mainFrame:action.targetFrame?.isMainFrame == true) {
            decisionHandler(.allow)
        } else if original.responds(to: #selector(CineGeniusNavigationDelegate.webView(_:decidePolicyFor:decisionHandler:))) {
            original.webView?(webView, decidePolicyFor: action, decisionHandler: decisionHandler)
        } else { decisionHandler(.cancel) }
    }
}

extension CineGeniusViewController {
    func fetchWorkplaceAccount() async throws -> WorkplaceAccount {
        guard let webView, let configured = bridge?.config.serverURL, let policy = WorkplaceOriginPolicy(configured: configured),
              let url = webView.url,
              policy.permits(mainFrame: true, request: url, current: url, securityScheme: url.scheme ?? "", securityHost: url.host ?? "", securityPort: url.port ?? 0),
              let sourceURL = Bundle.main.resourceURL?.appendingPathComponent("public/workplace-account.js"),
              let source = try? String(contentsOf: sourceURL, encoding: .utf8) else { throw WorkplaceAccessError.accountUnavailable }
        // No token copying into native storage or a page-defined JavaScript API.
        let result = try await webView.callAsyncJavaScript(source, arguments: [:], in: nil, contentWorld: .world(name: "CineGeniusPrivateAccount"))
        guard webView.url == url, let json = result as? String, let data = json.data(using: .utf8) else { throw WorkplaceAccessError.accountChanged }
        if let issue = try? JSONSerialization.jsonObject(with: data) as? [String: String], let code = issue["error"] {
            throw WorkplaceAccessError(rawValue: code) ?? .accountUnavailable
        }
        let account = try JSONDecoder().decode(WorkplaceAccount.self, from: data)
        try account.validate(); return account
    }
    func showSignIn() {
        guard let configured = bridge?.config.serverURL else { return }
        webView?.load(URLRequest(url: configured.appendingPathComponent("sign-in")))
    }
}
