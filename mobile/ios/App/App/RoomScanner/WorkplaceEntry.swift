import UIKit
import SwiftUI
import WebKit
import Capacitor

final class WorkplaceScriptHandler: NSObject, WKScriptMessageHandler {
    weak var owner: CineGeniusViewController?
    init(owner: CineGeniusViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let owner, message.name == "cinegeniusWorkplace", message.webView === owner.webView,
              let configured = owner.bridge?.config.serverURL, let policy = WorkplaceOriginPolicy(configured:configured),
              policy.permits(mainFrame:message.frameInfo.isMainFrame,request:message.frameInfo.request.url,current:owner.webView?.url,securityScheme:message.frameInfo.securityOrigin.protocol,securityHost:message.frameInfo.securityOrigin.host,securityPort:message.frameInfo.securityOrigin.port),
              let body = message.body as? [String:Any], Set(body.keys).isSubset(of:["action","locale"]),
              body["action"] as? String == "openWorkplace" else { return }
        let strings = ScannerStrings()
        let locale = (body["locale"] as? String).flatMap { strings.valid($0) }
        owner.openWorkplace(locale:locale)
    }
}

@available(iOS 16.0, *)
final class WorkplaceHostingController: UIHostingController<NativeWorkplaceView> {
    let model: ScannerModel
    init(strings: ScannerStrings, account: WorkplaceAccount, access: @escaping () async throws -> WorkplaceAccount) {
        model = ScannerModel(strings:strings, account:account, access:access)
        super.init(rootView:NativeWorkplaceView(model:model,strings:strings))
        overrideUserInterfaceStyle = .dark
        modalPresentationStyle = .fullScreen; isModalInPresentation = true
        model.onClose = { [weak self] in self?.presentingViewController?.dismiss(animated:true) }
    }
    required init?(coder: NSCoder) { return nil }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}

extension CineGeniusViewController {
    func installWorkplaceMenu() {
        guard let webView, workplaceContentController !== webView.configuration.userContentController,
              let url = Bundle.main.resourceURL?.appendingPathComponent("public/workplace-menu.js"), let script = try? String(contentsOf:url,encoding:.utf8) else { return }
        let handler = WorkplaceScriptHandler(owner:self)
        webView.configuration.userContentController.add(handler,name:"cinegeniusWorkplace")
        webView.configuration.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentEnd,forMainFrameOnly:true))
        workplaceContentController = webView.configuration.userContentController
    }
    func openWorkplace(locale: String? = nil) {
        guard !isOpeningWorkplace, presentedViewController == nil, viewIfLoaded?.window != nil else { return }
        nativeVoice?.cancelAll()
        isOpeningWorkplace = true
        let strings = ScannerStrings(preference:locale)
        let progress = UIActivityIndicatorView(style:.large)
        progress.color = UIColor(Color.lime); progress.translatesAutoresizingMaskIntoConstraints = false
        progress.accessibilityLabel = strings.text("accountLoading")
        progress.backgroundColor = UIColor.black.withAlphaComponent(0.8); progress.layer.cornerRadius = 16
        view.addSubview(progress)
        NSLayoutConstraint.activate([progress.centerXAnchor.constraint(equalTo:view.centerXAnchor), progress.centerYAnchor.constraint(equalTo:view.centerYAnchor), progress.widthAnchor.constraint(equalToConstant:80), progress.heightAnchor.constraint(equalToConstant:80)])
        progress.startAnimating()
        Task { @MainActor in
            defer { isOpeningWorkplace = false; progress.removeFromSuperview() }
            do {
                let account = try await fetchWorkplaceAccount()
                if locale == nil, let webView {
                    let preference = try? await webView.callAsyncJavaScript("if (!window.cookieStore) return null; const item = await window.cookieStore.get('cg_locale'); return item ? item.value : null;",arguments:[:],in:nil,contentWorld:.world(name:"CineGeniusPrivateAccount"))
                    if let preference = preference as? String, strings.valid(preference) != nil { strings.select(preference:preference) }
                }
                guard presentedViewController == nil, viewIfLoaded?.window != nil else { return }
                if #available(iOS 16.0, *) {
                    if let suspended = suspendedWorkplaces.removeValue(forKey:account.accountID) as? WorkplaceHostingController {
                        present(suspended,animated:true)
                        return
                    }
                    let host = WorkplaceHostingController(strings:strings,account:account) { [weak self] in
                        guard let self else { throw WorkplaceAccessError.accountUnavailable }
                        return try await self.fetchWorkplaceAccount()
                    }
                    host.model.onSignIn = { [weak self, weak host] in
                        guard let self, let host else { return }
                        self.suspendedWorkplaces[host.model.accountID] = host; self.requestsWorkplace = true
                        self.dismiss(animated:true) { self.showSignIn() }
                    }
                    host.model.onSuspend = { [weak self, weak host] in
                        guard let self, let host else { return }
                        self.suspendedWorkplaces[host.model.accountID] = host; self.requestsWorkplace = false
                        self.dismiss(animated:true)
                    }
                    present(host,animated:true)
                } else {
                    let alert = UIAlertController(title:strings.text("workplaceTitle"),message:strings.text("iosRequired"),preferredStyle:.alert)
                    alert.addAction(UIAlertAction(title:strings.text("done"),style:.cancel)); present(alert,animated:true)
                }
            } catch {
                if error as? WorkplaceAccessError == .signInRequired {
                    requestsWorkplace = true; showSignIn(); return
                }
                let alert = UIAlertController(title:strings.text("workplaceTitle"),message:strings.text((error as? WorkplaceAccessError)?.rawValue ?? "accountUnavailable"),preferredStyle:.alert)
                alert.addAction(UIAlertAction(title:strings.text("retry"),style:.default) { [weak self] _ in self?.openWorkplace(locale:locale) })
                alert.addAction(UIAlertAction(title:strings.text("cancel"),style:.cancel))
                if presentedViewController == nil { present(alert,animated:true) }
            }
        }
    }
    func lockWorkplace() {
        if #available(iOS 16.0, *), let host = presentedViewController as? WorkplaceHostingController { host.model.lockForBackground() }
    }
}
