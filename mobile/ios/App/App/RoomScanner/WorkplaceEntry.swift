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
    init(strings: ScannerStrings) {
        model = ScannerModel(strings:strings)
        super.init(rootView:NativeWorkplaceView(model:model,strings:strings))
        overrideUserInterfaceStyle = .dark
        modalPresentationStyle = .fullScreen; isModalInPresentation = true
        model.onClose = { [weak self] in self?.dismiss(animated:true) }
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
        isOpeningWorkplace = true
        let strings = ScannerStrings(preference:locale)
        func present() {
            self.isOpeningWorkplace = false
            guard self.presentedViewController == nil, self.viewIfLoaded?.window != nil else { return }
            if #available(iOS 16.0, *) { self.present(WorkplaceHostingController(strings:strings),animated:true) }
            else {
                let alert = UIAlertController(title:strings.text("title"),message:strings.text("iosRequired"),preferredStyle:.alert)
                alert.addAction(UIAlertAction(title:strings.text("done"),style:.cancel)); self.present(alert,animated:true)
            }
        }
        guard locale == nil, let webView, let configured = bridge?.config.serverURL, let policy = WorkplaceOriginPolicy(configured:configured),
              policy.permits(mainFrame:true,request:webView.url,current:webView.url,securityScheme:configured.scheme ?? "",securityHost:configured.host ?? "",securityPort:configured.port ?? 0) else { present(); return }
        // CookieStore.get reads only this named public preference. No session cookie enumeration.
        Task { @MainActor in
            let value = try? await webView.callAsyncJavaScript("if (!window.cookieStore) return null; const item = await window.cookieStore.get('cg_locale'); return item ? item.value : null;",arguments:[:],in:nil,contentWorld:.page)
            if let locale = value as? String, strings.valid(locale) != nil { strings.select(preference:locale) }
            present()
        }
    }
    func lockWorkplace() {
        if #available(iOS 16.0, *), let host = presentedViewController as? WorkplaceHostingController { host.model.lockForBackground() }
    }
}
