import SwiftUI

@available(iOS 16.0, *)
struct PlanEditorView: View {
    @ObservedObject var model: ScannerModel
    @ObservedObject var strings: ScannerStrings
    @Environment(\.dismiss) private var dismiss
    @State private var viewport = PlanViewport()
    @State private var size = CGSize(width:320,height:400)
    @State private var sheet: EditorSheet?
    enum EditorSheet: Identifiable {
        case catalog, objectList, inspect(PlanObject)
        var id: String { switch self { case .catalog:return "catalog"; case .objectList:return "objects"; case .inspect(let object):return object.id.uuidString } }
    }
    private var selected: PlanObject? { model.history.objects.first { $0.id == model.selectedObjectID } }
    var body: some View {
        NavigationStack {
            VStack(spacing:8) {
                Text(strings.text("gestureHelp")).font(.footnote).foregroundColor(.secondary).padding(.horizontal)
                if let draft = model.draft {
                    GeometryReader { geometry in
                        PlanEditorCanvas(plan:draft.plan,objects:model.history.objects,viewport:$viewport,selection:$model.selectedObjectID,strings:strings,commit:model.applyObjects)
                            .onAppear { size = geometry.size }.onChange(of:geometry.size) { size = $0 }
                    }.padding(.horizontal,8)
                }
                HStack(spacing:2) {
                    tool("list.bullet","objects") { sheet = .objectList }
                    tool("minus.magnifyingglass","zoomOut") { viewport.zoom = max(0.3,viewport.zoom/1.25) }
                    tool("plus.magnifyingglass","zoomIn") { viewport.zoom = min(8,viewport.zoom*1.25) }
                    tool("rotate.right","rotatePlan") { viewport.rotation += .pi/2 }
                    tool("arrow.counterclockwise","resetView") { viewport = PlanViewport() }
                    tool("arrow.uturn.backward","undo") { model.undo() }.disabled(!model.history.canUndo)
                    tool("arrow.uturn.forward","redo") { model.redo() }.disabled(!model.history.canRedo)
                }
                if let selected {
                    HStack(spacing:2) {
                        Text(selected.label.isEmpty ? strings.text(selected.kind.rawValue) : selected.label).font(.caption).lineLimit(2)
                        Spacer(minLength:0)
                        tool("slider.horizontal.3","objectDetails") { sheet = .inspect(selected) }
                        tool("rotate.right","rotateObject") { var changed = selected; changed.rotation = (changed.rotation+90).truncatingRemainder(dividingBy:360); replace(changed) }
                        tool("plus.square.on.square","duplicateObject") { var copy = selected; copy.id = UUID(); copy.center.x += 0.25; copy.center.z += 0.25; model.applyObjects(model.history.objects+[copy]); model.selectedObjectID = copy.id }
                        tool("trash","delete") { model.applyObjects(model.history.objects.filter { $0.id != selected.id }); model.selectedObjectID = nil }
                    }.padding(.horizontal)
                }
                Button { sheet = .catalog } label: { Label(strings.text("addObject"),systemImage:"plus").frame(maxWidth:.infinity,minHeight:44) }
                    .buttonStyle(.borderedProminent).tint(.lime).foregroundColor(.black).padding(.horizontal).padding(.bottom,8)
            }
            .background(Color(red:0.055,green:0.065,blue:0.085))
            .navigationTitle(model.accountReady && !model.needsUnlock ? model.name : strings.text("floorPlansTitle")).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement:.navigationBarLeading) { Button(strings.text("back")) { dismiss() }.frame(minHeight:44) }
                ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("saveShort")) { Task { await model.save() } }.frame(minHeight:44).disabled(model.saved || model.busy) }
            }
            .sheet(item:$sheet) { item in
                switch item {
                case .catalog: catalog
                case .objectList:
                    NavigationStack {
                        List(model.history.objects) { object in
                            Button { model.selectedObjectID = object.id; sheet = .inspect(object) } label: {
                                Label(object.label.isEmpty ? strings.text(object.kind.rawValue) : object.label,systemImage:object.kind.symbol).frame(minHeight:44)
                            }
                        }.navigationTitle(strings.text("objects"))
                            .toolbar { ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("close")) { sheet = nil }.frame(minHeight:44) } }
                            .overlay { WorkplaceLockCover(model:model,strings:strings) }
                    }
                case .inspect(let object): PlanObjectInspector(model:model,strings:strings,original:object)
                }
            }
            .overlay { WorkplaceLockCover(model:model,strings:strings) }
        }.tint(.lime).preferredColorScheme(.dark).interactiveDismissDisabled()
        .alert(strings.text("errorTitle"),isPresented:Binding(get:{ model.notice != nil },set:{ if !$0 { model.notice = nil } })) {
            Button(strings.text("done"),role:.cancel) { model.notice = nil }
        } message: { Text(strings.text(model.notice ?? "errorTitle")) }
    }
    private func replace(_ object: PlanObject) { model.applyObjects(model.history.objects.map { $0.id == object.id ? object : $0 }) }
    private func tool(_ symbol: String, _ key: String, action: @escaping () -> Void) -> some View {
        Button(action:action) { Image(systemName:symbol).frame(minWidth:44,minHeight:44) }.accessibilityLabel(strings.text(key)).disabled(model.busy)
    }
    private var catalog: some View {
        NavigationStack {
            List {
                ForEach(["furniture","power","water","film"],id:\.self) { group in
                    Section(strings.text(group)) {
                        ForEach(PlanObjectKind.allCases.filter { $0.group == group },id:\.self) { kind in
                            Button {
                                guard let draft = model.draft else { return }
                                let transform = PlanTransform(plan:draft.plan,width:size.width,height:size.height,viewport:viewport)
                                let object = PlanObject(kind:kind,center:transform.world(PlanPoint(size.width/2,size.height/2)))
                                model.applyObjects(model.history.objects+[object]); model.selectedObjectID = object.id; sheet = nil
                            } label: { Label(strings.text(kind.rawValue),systemImage:kind.symbol).frame(minHeight:44) }
                        }
                    }
                }
                Section { Text(strings.text("objectPlanningNotice")).font(.footnote).foregroundColor(.secondary) }
            }.navigationTitle(strings.text("addObject"))
                .toolbar { ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("close")) { sheet = nil }.frame(minHeight:44) } }
                .overlay { WorkplaceLockCover(model:model,strings:strings) }
        }
    }
}

@available(iOS 16.0, *)
struct PlanObjectInspector: View {
    @ObservedObject var model: ScannerModel
    @ObservedObject var strings: ScannerStrings
    let original: PlanObject
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var note = ""
    @State private var width = ""
    @State private var depth = ""
    @State private var x = ""
    @State private var z = ""
    @State private var rotation = ""
    @State private var error = false
    @State private var discard = false
    @State private var loaded = false
    private var changed: Bool {
        label != original.label || note != original.note || width != strings.number(original.width) || depth != strings.number(original.depth)
        || x != strings.number(original.center.x) || z != strings.number(original.center.z) || rotation != strings.number(original.rotation)
    }
    var body: some View {
        NavigationStack {
            Form {
                Section(strings.text("objectDetails")) {
                    field("objectLabel",$label)
                    TextField(strings.text("objectNote"),text:$note,axis:.vertical).lineLimit(3...6)
                }
                Section(strings.text("dimensionsMetres")) { field("objectWidth",$width); field("objectDepth",$depth) }
                Section(strings.text("positionMetres")) { field("positionX",$x); field("positionZ",$z); field("rotationDegrees",$rotation) }
                Text(strings.text("objectPlanningNotice")).font(.footnote).foregroundColor(.secondary)
                if error { Text(strings.text("invalidObject")).foregroundColor(.red) }
            }.navigationTitle(strings.text(original.kind.rawValue)).scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement:.navigationBarLeading) { Button(strings.text("cancel")) { if changed { discard = true } else { dismiss() } }.frame(minHeight:44) }
                ToolbarItem(placement:.navigationBarTrailing) { Button(strings.text("done")) { save() }.frame(minHeight:44).disabled(!model.accountReady || model.busy) }
            }
            .confirmationDialog(strings.text("discardTitle"),isPresented:$discard) {
                Button(strings.text("discard"),role:.destructive) { dismiss() }
                Button(strings.text("keepEditing"),role:.cancel) {}
            }
            .overlay { WorkplaceLockCover(model:model,strings:strings) }
            .onAppear {
                guard !loaded else { return }; loaded = true
                label = original.label; note = original.note; width = strings.number(original.width); depth = strings.number(original.depth)
                x = strings.number(original.center.x); z = strings.number(original.center.z); rotation = strings.number(original.rotation)
            }
        }.interactiveDismissDisabled()
    }
    private func field(_ key: String, _ value: Binding<String>) -> some View {
        VStack(alignment:.leading) { Text(strings.text(key)).font(.caption).foregroundColor(.secondary); TextField(strings.text(key),text:value).frame(minHeight:44) }
    }
    private func save() {
        guard model.accountReady, !model.needsUnlock,
              let w = strings.parseNumber(width), let d = strings.parseNumber(depth), let px = strings.parseNumber(x), let pz = strings.parseNumber(z), let r = strings.parseNumber(rotation) else { error = true; return }
        var value = original; value.label = label; value.note = note; value.width = w; value.depth = d; value.center = PlanPoint(px,pz); value.rotation = r
        guard value.valid else { error = true; return }
        model.applyObjects(model.history.objects.map { $0.id == value.id ? value : $0 }); dismiss()
    }
}

@available(iOS 16.0, *)
struct WorkplaceLockCover: View {
    @ObservedObject var model: ScannerModel
    @ObservedObject var strings: ScannerStrings
    var body: some View {
        if model.covered { Color.black.ignoresSafeArea() }
        else if model.needsUnlock || !model.accountReady {
            VStack(spacing:20) {
                Image(systemName:"lock").font(.largeTitle)
                Text(strings.text("locked"))
                Button(strings.text("unlock")) { Task { await model.loadLibrary() } }.frame(minWidth:44,minHeight:44)
                Button(strings.text("signInAgain")) { model.onSignIn?() }.frame(minWidth:44,minHeight:44)
                Button(strings.text("close")) { model.onSuspend?() }.frame(minWidth:44,minHeight:44)
            }.padding(24).frame(maxWidth:.infinity,maxHeight:.infinity).background(Color.black).ignoresSafeArea()
        }
    }
}
