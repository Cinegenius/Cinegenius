import UIKit
import Capacitor
import WebKit

#if !DEBUG
#error("CineGenius remote-content preview is development-only. Resolve the distribution architecture before release.")
#endif

class CineGeniusViewController: CAPBridgeViewController {
    private var loadingObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?
    private var hasViewportAdapter = false
    var nativeVoice: NativeVoice?
    var suspendedWorkplaces: [String:UIViewController] = [:]
    var isOpeningWorkplace = false
    private var accountNavigationDelegate: CineGeniusNavigationDelegate?
    weak var workplaceContentController: WKUserContentController?
    var requestsWorkplace = ProcessInfo.processInfo.arguments.contains("--cinegenius-workplace") || ProcessInfo.processInfo.arguments.contains("--cinegenius-room-scanner")

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if requestsWorkplace, webView?.isLoading == false, webView?.url != nil { requestsWorkplace = false; openWorkplace() }
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.websiteDataStore = .default()
        return configuration
    }

    private func installViewportAdapter() {
        guard !hasViewportAdapter, let webView,
              let url = Bundle.main.resourceURL?.appendingPathComponent("public/app-viewport.js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else { return }
        // Install on the actual view before its first load: Capacitor replaces
        // the content controller after webViewConfiguration returns.
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true,
            in: .defaultClient
        ))
        hasViewportAdapter = true
    }

    func resumeRequestedWorkplace() {
        guard requestsWorkplace, !isOpeningWorkplace, let webView, !webView.isLoading,
              let url = webView.url, url.host == bridge?.config.serverURL.host,
              !url.path.hasPrefix("/sign-in"), !url.path.hasPrefix("/sign-up"), url.path != "/offline.html" else { return }
        requestsWorkplace = false; openWorkplace()
    }

    func notifyWebAppResume() {
        guard let webView, let configured = bridge?.config.serverURL,
              let policy = WorkplaceOriginPolicy(configured: configured), let url = webView.url,
              policy.permits(mainFrame: true, request: url, current: url,
                  securityScheme: url.scheme ?? "", securityHost: url.host ?? "", securityPort: url.port ?? 0),
              let scriptURL = Bundle.main.resourceURL?.appendingPathComponent("public/app-resume.js"),
              let source = try? String(contentsOf: scriptURL, encoding: .utf8) else { return }
        // The script rechecks the main frame's origin at execution time. It
        // dispatches the shared website event without exposing native data.
        webView.evaluateJavaScript(source, completionHandler: nil)
    }

    private func placeWebView() {
        guard let webView, view === webView else { return }

        let container = UIView()
        container.backgroundColor = webView.backgroundColor
        view = container

        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        let safeArea = container.safeAreaLayoutGuide
        // The bundled adapter protects controls, while the page background fills
        // the screen. An incomplete local bundle retains the safe legacy layout.
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: hasViewportAdapter ? container.topAnchor : safeArea.topAnchor),
            webView.bottomAnchor.constraint(equalTo: hasViewportAdapter ? container.bottomAnchor : safeArea.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: hasViewportAdapter ? container.leadingAnchor : safeArea.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: hasViewportAdapter ? container.trailingAnchor : safeArea.trailingAnchor)
        ])
        // Web CSS owns safe-area spacing. Do not also inset the whole viewport.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        installViewportAdapter()
        placeWebView()
        installWorkplaceMenu()
        nativeVoice = NativeVoice(owner: self)
        if let original = webView?.navigationDelegate {
            let delegate = CineGeniusNavigationDelegate(original: original)
            accountNavigationDelegate = delegate; webView?.navigationDelegate = delegate
        }
        urlObservation = webView?.observe(\.url, options:[.new]) { [weak self] _,_ in
            DispatchQueue.main.async { self?.nativeVoice?.cancelAll(); self?.resumeRequestedWorkplace() }
        }
        webView?.allowsBackForwardNavigationGestures = true
        statusBarStyle = .lightContent
        loadingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
            if view.isLoading { self?.nativeVoice?.cancelAll() }
            if !view.isLoading { self?.resumeRequestedWorkplace() }
            guard !view.isLoading, let self,
                  let local = self.bridge?.config.localURL,
                  let url = view.url,
                  url.scheme == local.scheme, url.host == local.host,
                  url.path == "/offline.html" || url.path == "/index.html",
                  let host = self.bridge?.config.serverURL.host else { return }
            view.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak view] cookies in
                // Forward only the non-secret language preference, never auth material.
                let locale = cookies.first { cookie in
                    let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
                    return cookie.name == "cg_locale" && !cookie.isHTTPOnly
                        && (host == domain || host.hasSuffix("." + domain))
                }?.value
                guard let locale,
                      let data = try? JSONSerialization.data(withJSONObject: [locale]),
                      let json = String(data: data, encoding: .utf8) else { return }
                DispatchQueue.main.async {
                    guard let view, view.url == url else { return }
                    view.evaluateJavaScript("window.cinegeniusSavedLocale=\(json)[0];window.dispatchEvent(new CustomEvent('cinegenius:locale',{detail:window.cinegeniusSavedLocale}));", completionHandler: nil)
                }
            }
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        application.shortcutItems = [UIApplicationShortcutItem(type: "co.cinegenius.app.preview.workplace", localizedTitle: ScannerStrings().text("workplaceTitle"), localizedSubtitle: nil, icon: UIApplicationShortcutIcon(systemImageName: "square.grid.2x2"), userInfo: nil)]
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
