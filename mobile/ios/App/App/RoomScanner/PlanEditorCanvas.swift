import SwiftUI
import UIKit

@available(iOS 16.0, *)
struct PlanEditorCanvas: UIViewRepresentable {
    let plan: FloorPlan
    let objects: [PlanObject]
    @Binding var viewport: PlanViewport
    @Binding var selection: UUID?
    let strings: ScannerStrings
    var editable = true
    let commit: ([PlanObject]) -> Void
    func makeUIView(context: Context) -> PlanEditorUIView { PlanEditorUIView() }
    func updateUIView(_ view: PlanEditorUIView, context: Context) {
        view.plan = plan; view.objects = objects; view.viewport = viewport; view.selection = selection
        view.strings = strings; view.isUserInteractionEnabled = editable
        view.onViewport = { viewport = $0 }; view.onSelection = { selection = $0 }; view.onCommit = commit
        view.accessibilityLabel = strings.text("floorPlan")
        view.accessibilityHint = strings.text("gestureHelp")
        view.setNeedsDisplay()
    }
}

/// Exactly two touches move the viewport; one touch can move a selected object.
/// Simultaneous recognition is confined to our pinch and two-finger pan.
final class PlanEditorUIView: UIView, UIGestureRecognizerDelegate {
    var plan: FloorPlan = .example
    var objects: [PlanObject] = []
    var viewport = PlanViewport()
    var selection: UUID?
    var strings: ScannerStrings?
    var onViewport: ((PlanViewport) -> Void)?
    var onSelection: ((UUID?) -> Void)?
    var onCommit: (([PlanObject]) -> Void)?
    private var dragging: PlanObject?
    private var dragOrigin: CGPoint?
    private var dragTransform: PlanTransform?
    private lazy var pan = UIPanGestureRecognizer(target:self,action:#selector(moveView(_:)))
    private lazy var pinch = UIPinchGestureRecognizer(target:self,action:#selector(zoomView(_:)))
    private lazy var objectPan = UIPanGestureRecognizer(target:self,action:#selector(moveObject(_:)))
    override init(frame: CGRect) {
        super.init(frame:frame)
        backgroundColor = UIColor(red:0.055,green:0.065,blue:0.085,alpha:1)
        isOpaque = true; clipsToBounds = true; layer.cornerRadius = 14
        pan.minimumNumberOfTouches = 2; pan.maximumNumberOfTouches = 2
        objectPan.minimumNumberOfTouches = 1; objectPan.maximumNumberOfTouches = 1
        for recognizer in [pan, pinch, objectPan] { recognizer.delegate = self; addGestureRecognizer(recognizer) }
        let tap = UITapGestureRecognizer(target:self,action:#selector(selectObject(_:))); tap.require(toFail:objectPan); addGestureRecognizer(tap)
        isAccessibilityElement = true; accessibilityTraits = .image
    }
    required init?(coder: NSCoder) { nil }
    private var planTransform: PlanTransform { PlanTransform(plan:plan,width:bounds.width,height:bounds.height,viewport:viewport) }
    private func p(_ value: CGPoint) -> PlanPoint { PlanPoint(value.x,value.y) }
    private func cg(_ value: PlanPoint) -> CGPoint { CGPoint(x:value.x,y:value.z) }
    private var displayObjects: [PlanObject] { objects.map { $0.id == dragging?.id ? dragging! : $0 } }
    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext(), let strings else { return }
        let t = planTransform
        let wallNumbers = Dictionary(uniqueKeysWithValues:plan.walls.enumerated().map { ($0.element.id,$0.offset+1) })
        for segment in plan.segments {
            let a = cg(t.screen(segment.start)), b = cg(t.screen(segment.end))
            context.setStrokeColor(UIColor(PlanLineStyle.color(segment.kind)).cgColor)
            context.setLineWidth(segment.kind == .wall ? 4 : 6); context.setLineDash(phase:0,lengths:PlanLineStyle.dash(segment.kind))
            context.move(to:a); context.addLine(to:b); context.strokePath()
            if let number = wallNumbers[segment.id] {
                let label = strings.text("wallLabel",["number":String(number),"length":strings.number(segment.length)])
                (label as NSString).draw(at:CGPoint(x:(a.x+b.x)/2-36,y:(a.y+b.y)/2-19),withAttributes:[.font:UIFont.systemFont(ofSize:11,weight:.semibold),.foregroundColor:UIColor.white])
            }
        }
        for (index,object) in displayObjects.enumerated() {
            PlanObjectDrawing.draw(object, number:index+1, context:context, point:{ self.cg(t.screen($0)) }, selected:object.id == selection, dark:true)
        }
    }
    private func hit(_ point: CGPoint) -> PlanObject? {
        let t = planTransform
        // Reverse paint order. Touch targets remain at least 44pt even for sockets.
        return objects.reversed().first { object in
            let world = t.world(p(point)), r = -object.rotation * .pi/180
            let x = world.x-object.center.x, z = world.z-object.center.z
            return abs(x*cos(r)-z*sin(r)) <= max(object.width/2,22/t.scale)
                && abs(x*sin(r)+z*cos(r)) <= max(object.depth/2,22/t.scale)
        }
    }
    override func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
        if recognizer === objectPan { return recognizer.numberOfTouches == 1 && hit(recognizer.location(in:self)) != nil }
        return true
    }
    func gestureRecognizer(_ a: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith b: UIGestureRecognizer) -> Bool {
        (a === pan && b === pinch) || (a === pinch && b === pan)
    }
    @objc private func selectObject(_ recognizer: UITapGestureRecognizer) {
        selection = hit(recognizer.location(in:self))?.id; onSelection?(selection); setNeedsDisplay()
    }
    @objc private func moveView(_ recognizer: UIPanGestureRecognizer) {
        let delta = recognizer.translation(in:self); recognizer.setTranslation(.zero,in:self)
        viewport.offset.x += delta.x; viewport.offset.z += delta.y
        onViewport?(viewport); setNeedsDisplay()
    }
    @objc private func zoomView(_ recognizer: UIPinchGestureRecognizer) {
        let anchor = p(recognizer.location(in:self)), world = planTransform.world(anchor)
        viewport.zoom = min(8,max(0.3,viewport.zoom * recognizer.scale)); recognizer.scale = 1
        let shifted = planTransform.screen(world)
        viewport.offset.x += anchor.x-shifted.x; viewport.offset.z += anchor.z-shifted.z
        onViewport?(viewport); setNeedsDisplay()
    }
    @objc private func moveObject(_ recognizer: UIPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            dragging = hit(recognizer.location(in:self)); dragOrigin = recognizer.location(in:self); dragTransform = planTransform
            selection = dragging?.id; onSelection?(selection)
        case .changed:
            guard recognizer.numberOfTouches == 1 else {
                dragging = nil; dragOrigin = nil; dragTransform = nil
                recognizer.isEnabled = false; recognizer.isEnabled = true
                setNeedsDisplay(); return
            }
            if let origin = dragOrigin, let t = dragTransform, let original = objects.first(where: { $0.id == dragging?.id }) {
                let start = t.world(p(origin)), end = t.world(p(recognizer.location(in:self)))
                let candidate = PlanPoint(original.center.x+end.x-start.x,original.center.z+end.z-start.z)
                if candidate.valid { dragging?.center = candidate }
            }
        case .ended:
            if let dragging { onCommit?(objects.map { $0.id == dragging.id ? dragging : $0 }) }
            dragging = nil; dragOrigin = nil; dragTransform = nil
        case .cancelled, .failed:
            dragging = nil; dragOrigin = nil; dragTransform = nil
        default: break
        }
        setNeedsDisplay()
    }
}

enum PlanObjectDrawing {
    static func draw(_ object: PlanObject, number: Int, context: CGContext, point: (PlanPoint) -> CGPoint, selected: Bool = false, dark: Bool) {
        let color: UIColor = object.kind.group == "power" ? .systemYellow : object.kind.group == "water" ? .systemCyan : dark ? UIColor(Color.lime) : .black
        context.saveGState(); defer { context.restoreGState() }
        context.setLineDash(phase:0,lengths:[])
        let corners = object.corners.map(point)
        context.move(to:corners[0]); corners.dropFirst().forEach { context.addLine(to:$0) }; context.closePath()
        context.setFillColor(color.withAlphaComponent(dark ? 0.16 : 0.08).cgColor)
        context.setStrokeColor(color.cgColor); context.setLineWidth(selected ? 3 : 1.5); context.drawPath(using:.fillStroke)
        let center = point(object.center)
        if let symbol = UIImage(systemName:object.kind.symbol)?.withTintColor(color,renderingMode:.alwaysOriginal) {
            symbol.draw(in:CGRect(x:center.x-10,y:center.y-10,width:20,height:20))
        }
        let text = "\(number)" + (object.label.isEmpty ? "" : " · \(object.label)")
        (text as NSString).draw(in:CGRect(x:center.x-45,y:center.y+12,width:90,height:28),withAttributes:[.font:UIFont.systemFont(ofSize:10,weight:.semibold),.foregroundColor:dark ? UIColor.white : UIColor.black])
    }
}
