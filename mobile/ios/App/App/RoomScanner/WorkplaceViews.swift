import SwiftUI
import AVFoundation

@available(iOS 16.0, *)
struct NativeWorkplaceView: View {
    enum Route: Hashable { case locations, floorPlans }
    @ObservedObject var model: ScannerModel
    @ObservedObject var strings: ScannerStrings
    @State private var path: [Route] = []
    var body: some View {
        NavigationStack(path:$path) {
            ScrollView {
                VStack(alignment:.leading,spacing:24) {
                    Text(strings.text("workplaceSubtitle")).font(.title2)
                    Text(strings.text("departments")).font(.headline).foregroundColor(.secondary)
                    NavigationLink(value:Route.locations) { card("locationsTitle","locationsDescription",icon:"mappin.and.ellipse") }
                    Text(strings.text("localPrivacy")).font(.footnote).foregroundColor(.secondary)
                }.padding(20)
            }.navigationTitle(strings.text("workplaceTitle"))
            .navigationDestination(for:Route.self) { route in
                switch route {
                case .locations:
                    ScrollView { VStack(alignment:.leading,spacing:24) {
                        Text(strings.text("locationsDescription")).font(.title2)
                        NavigationLink(value:Route.floorPlans) { card("floorPlansTitle","floorPlansDescription",icon:"square.dashed") }
                    }.padding(20) }.navigationTitle(strings.text("locationsTitle"))
                        .toolbar { ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("close")) { model.request(.close) }.frame(minWidth:44,minHeight:44).disabled(model.busy) } }
                case .floorPlans:
                    FloorPlansScreen(model:model,strings:strings).navigationTitle(strings.text("floorPlansTitle"))
                        .navigationBarBackButtonHidden(true)
                        .toolbar {
                            ToolbarItem(placement:.navigationBarLeading) { Button { model.request(.back) } label: { Label(strings.text("back"),systemImage:"chevron.left").frame(minWidth:44,minHeight:44) } }
                            ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("close")) { model.request(.close) }.frame(minWidth:44,minHeight:44).disabled(model.busy) }
                        }
                        .onAppear { model.onBack = { if !path.isEmpty { path.removeLast() } } }
                }
            }
            .toolbar { ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("close")) { model.request(.close) }.frame(minWidth:44,minHeight:44).disabled(model.busy) } }
        }
        .tint(.lime).preferredColorScheme(.dark).environment(\.locale,Locale(identifier:strings.locale))
        .interactiveDismissDisabled()
        .confirmationDialog(strings.text("discardTitle"),isPresented:$model.showDiscardPrompt,titleVisibility:.visible) {
            if model.draft != nil { Button(strings.text(model.draft?.plan.source == .example ? "sampleSave" : "save")) { Task { await model.save() } } }
            Button(strings.text("discard"),role:.destructive) { if let pending = model.pending { model.perform(pending) } }
            Button(strings.text("keepEditing"),role:.cancel) { model.pending = nil }
        } message: { Text(strings.text("discardBody")) }
        .alert(strings.text(model.notice == "saveSuccess" ? "saveSuccess" : "errorTitle"),isPresented:Binding(get:{model.notice != nil},set:{if !$0 {model.notice = nil}})) {
            if model.cameraDenied { Button(strings.text("openSettings")) { if let url = URL(string:UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } } }
            Button(strings.text("done"),role:.cancel) { model.notice = nil }
        } message: { Text(strings.text(model.notice == "saveSuccess" ? "localPrivacy" : model.notice ?? "errorTitle")) }
        .sheet(item:$model.share,onDismiss:{model.finishedSharing()}) { share in
            PlanShareSheet(share:share) { model.finishedSharing() }
        }
        .overlay { if model.covered { Color.black.ignoresSafeArea().accessibilityLabel(strings.text("locked")) } }
    }
    private func card(_ title: String, _ description: String, icon: String) -> some View {
        HStack(alignment:.top,spacing:18) {
            Image(systemName:icon).font(.title).foregroundColor(.lime).accessibilityHidden(true)
            VStack(alignment:.leading,spacing:8) { Text(strings.text(title)).font(.title2.bold()); Text(strings.text(description)).font(.body).foregroundColor(.secondary) }
            Spacer(minLength:0); Image(systemName:"chevron.right").accessibilityHidden(true)
        }.padding(20).frame(maxWidth:.infinity,minHeight:100,alignment:.leading).background(Color.white.opacity(0.06)).clipShape(RoundedRectangle(cornerRadius:16))
    }
}

@available(iOS 16.0, *)
struct FloorPlansScreen: View {
    @ObservedObject var model: ScannerModel
    @ObservedObject var strings: ScannerStrings
    @State private var exportNotice = false
    @State private var exportModel = false
    @State private var deletion: SavedFloorPlan?
    var body: some View {
        ScrollView {
            VStack(alignment:.leading,spacing:20) {
                if model.needsUnlock {
                    Text(strings.text("locked")).font(.title2)
                    action("unlock") { Task { await model.loadLibrary() } }
                } else if let capture = model.captureController {
                    RoomCaptureSurface(controller:capture).frame(height:420).clipShape(RoundedRectangle(cornerRadius:16))
                    Text(strings.text(model.captureState == .processing ? "processing" : "scanning"))
                    if model.captureState == .processing { ProgressView().tint(.lime) }
                    else { action("stopScan") { model.finishCapture() } }
                    Button(strings.text("cancel")) { model.request(.back) }.frame(minWidth:44,minHeight:44)
                } else if let record = model.draft {
                    review(record)
                } else {
                    landing
                }
                Text(strings.text("localPrivacy")).font(.footnote).foregroundColor(.secondary)
            }.padding(20)
        }.scrollDismissesKeyboard(.interactively)
        .confirmationDialog(strings.text("exportNotice"),isPresented:$exportNotice,titleVisibility:.visible) {
            Button(strings.text("confirmExport")) { model.export(model:exportModel) }
            Button(strings.text("cancel"),role:.cancel) {}
        }
        .alert(strings.text("deleteTitle"),isPresented:Binding(get:{deletion != nil},set:{if !$0 {deletion = nil}}),presenting:deletion) { record in
            Button(strings.text("confirmDelete"),role:.destructive) { Task { await model.deleteConfirmed(record) } }
            Button(strings.text("cancel"),role:.cancel) {}
        } message: { _ in Text(strings.text("deleteBody")) }
        .toolbar { ToolbarItemGroup(placement:.keyboard) { Spacer(); Button(strings.text("done")) { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder),to:nil,from:nil,for:nil) } } }
    }
    private var landing: some View {
        VStack(alignment:.leading,spacing:20) {
            Label(strings.text(model.supported ? "supported" : "unsupportedTitle"),systemImage:model.supported ? "viewfinder" : "viewfinder.circle").font(.title2.bold())
            if model.supported {
                action(model.captureState == .requesting ? "loading" : "startScan") { Task { await model.startCapture() } }.disabled(model.captureState != .idle)
                if model.cameraDenied { Button(strings.text("openSettings")) { if let url = URL(string:UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }.frame(minWidth:44,minHeight:44) }
            } else { Text(strings.text("unsupportedBody")).foregroundColor(.secondary) }
            action("showSample") { model.example() }
            Divider()
            Text(strings.text("savedPlans")).font(.title2.bold())
            if !model.unlocked {
                Text(strings.text("locked")).foregroundColor(.secondary)
                action("unlock") { Task { await model.loadLibrary() } }
            } else {
                if model.busy { ProgressView(strings.text("loading")) }
                if model.plans.isEmpty { Text(strings.text("emptyTitle")).font(.headline); Text(strings.text("emptyBody")).foregroundColor(.secondary) }
                ForEach(model.plans) { plan in
                    HStack {
                        Button { model.viewSaved(plan) } label: {
                            VStack(alignment:.leading,spacing:6) {
                                Text(plan.name).font(.headline)
                                if plan.plan.source == .example { Text(strings.text("sampleBadge")).font(.caption.bold()).foregroundColor(.lime) }
                                if !plan.localProject.isEmpty { Text(plan.localProject).font(.subheadline) }
                                Text(plan.createdAt,style:.date).font(.caption).foregroundColor(.secondary)
                            }.frame(maxWidth:.infinity,minHeight:54,alignment:.leading)
                        }
                        Button { deletion = plan } label: { Image(systemName:"trash").frame(minWidth:44,minHeight:44) }.accessibilityLabel(strings.text("delete") + ": " + plan.name)
                    }.padding(12).background(Color.white.opacity(0.05)).clipShape(RoundedRectangle(cornerRadius:12))
                }
                Button(strings.text("retry")) { Task { await model.loadLibrary() } }.frame(minWidth:44,minHeight:44)
            }
        }
    }
    private func review(_ record: SavedFloorPlan) -> some View {
        VStack(alignment:.leading,spacing:18) {
            Text(strings.text("reviewTitle")).font(.title2.bold())
            if record.plan.source == .example {
                Text(strings.text("sampleBadge")).font(.headline).foregroundColor(.lime)
                Text(strings.text("sampleBody")).foregroundColor(.secondary)
            }
            Text(strings.text("measurementNotice")).font(.footnote).foregroundColor(.secondary)
            FloorPlanCanvas(plan:record.plan,strings:strings)
            Text(strings.summary(record.plan)).font(.subheadline)
            Group {
                Text(strings.text("roomName")).font(.headline)
                TextField(strings.text("roomNamePlaceholder"),text:$model.name).textFieldStyle(.roundedBorder).accessibilityLabel(strings.text("roomName"))
                Text(strings.text("projectName")).font(.headline)
                TextField(strings.text("projectNamePlaceholder"),text:$model.project).textFieldStyle(.roundedBorder).accessibilityLabel(strings.text("projectName"))
            }.disabled(model.saved || model.busy)
            Text(strings.text("localProjectNote")).font(.footnote).foregroundColor(.secondary)
            if !model.saved { action(model.busy ? "saving" : record.plan.source == .example ? "sampleSave" : "save") { Task { await model.save() } }.disabled(model.busy) }
            action("exportPDF") { exportModel = false; exportNotice = true }
            if model.canExportModel { action("exportModel") { exportModel = true; exportNotice = true } }
            Text(strings.text("measurements")).font(.headline)
            ForEach(Array(record.plan.walls.enumerated()),id:\.element.id) { i,wall in
                Text(strings.text("wallDimension",["number":String(i+1),"length":strings.number(wall.length)]))
            }
            if model.supported { Button(strings.text("rescan")) { model.request(.rescan) }.frame(minWidth:44,minHeight:44) }
        }
    }
    private func action(_ key: String, run: @escaping () -> Void) -> some View {
        Button(action:run) { Text(strings.text(key)).frame(maxWidth:.infinity,minHeight:44) }.buttonStyle(.bordered).tint(.lime).disabled(model.busy)
    }
}
