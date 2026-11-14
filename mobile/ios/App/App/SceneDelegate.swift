import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var workplacePrivacyWindow: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let root = CineGeniusViewController()
        if connectionOptions.shortcutItem?.type == "co.cinegenius.app.preview.workplace" { root.requestsWorkplace = true }
        window?.rootViewController = root
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        guard shortcutItem.type == "co.cinegenius.app.preview.workplace", let root = window?.rootViewController as? CineGeniusViewController else { completionHandler(false); return }
        root.openWorkplace(); completionHandler(true)
    }
    func sceneWillResignActive(_ scene: UIScene) {
        guard #available(iOS 16.0, *), let root = window?.rootViewController as? CineGeniusViewController,
              root.presentedViewController is WorkplaceHostingController, let windowScene = scene as? UIWindowScene,
              workplacePrivacyWindow == nil else { return }
        // A passive app window also covers our own presented sharing sheets. It
        // never becomes key and does not intercept the system authentication UI.
        let cover = UIWindow(windowScene:windowScene)
        cover.windowLevel = .alert + 1
        let controller = UIViewController(); controller.view.backgroundColor = .black
        cover.rootViewController = controller; cover.isUserInteractionEnabled = false
        cover.isHidden = false; workplacePrivacyWindow = cover
    }
    func sceneDidEnterBackground(_ scene: UIScene) { (window?.rootViewController as? CineGeniusViewController)?.lockWorkplace() }
    func sceneDidBecomeActive(_ scene: UIScene) { workplacePrivacyWindow?.isHidden = true; workplacePrivacyWindow = nil }
}
