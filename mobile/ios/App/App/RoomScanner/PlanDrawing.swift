import SwiftUI
import UIKit

struct PlanProjection {
    let center: PlanPoint
    let scale: Double
    let frame: CGRect
    let rotation: Double
    init(plan: FloorPlan, frame: CGRect, rotation: Double = 0, zoom: Double = 1) {
        let points = plan.drawingPoints(rotation: rotation)
        let minX = points.map(\.x).min() ?? 0, maxX = points.map(\.x).max() ?? 1
        let minZ = points.map(\.z).min() ?? 0, maxZ = points.map(\.z).max() ?? 1
        center = PlanPoint((minX + maxX)/2, (minZ + maxZ)/2)
        scale = max(0.001, min(Double(frame.width - 76) / max(0.1, maxX-minX), Double(frame.height - 76) / max(0.1, maxZ-minZ))) * zoom
        self.frame = frame; self.rotation = rotation
    }
    func point(_ point: PlanPoint) -> CGPoint {
        let x = point.x * cos(rotation) - point.z * sin(rotation)
        let z = point.x * sin(rotation) + point.z * cos(rotation)
        return CGPoint(x: frame.midX + (x-center.x)*scale, y: frame.midY + (z-center.z)*scale)
    }
}
struct FloorPlanCanvas: View {
    let plan: FloorPlan
    @ObservedObject var strings: ScannerStrings
    @State private var zoom = 1.0
    @State private var gestureZoom = 1.0
    @State private var rotation = 0.0
    var body: some View {
        VStack {
            Canvas { context, size in
                let projection = PlanProjection(plan: plan, frame: CGRect(origin: .zero, size: size), rotation: rotation, zoom: min(4,max(0.5,zoom*gestureZoom)))
                let wallNumbers = Dictionary(uniqueKeysWithValues: plan.walls.enumerated().map { ($0.element.id,$0.offset+1) })
                for line in plan.segments {
                    let a = projection.point(line.start), b = projection.point(line.end)
                    var path = Path(); path.move(to: a); path.addLine(to: b)
                    let color: Color = line.kind == .wall ? .lime : line.kind == .door ? .cyan : line.kind == .window ? .blue : .orange
                    context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: line.kind == .wall ? 4 : 6, dash: PlanLineStyle.dash(line.kind)))
                    if let number = wallNumbers[line.id] {
                        let label = strings.text("wallLabel", ["number": String(number), "length": strings.number(line.length)])
                        context.draw(Text(label).font(.system(size: 11, weight: .semibold)).foregroundColor(.white), at: CGPoint(x: (a.x+b.x)/2, y: (a.y+b.y)/2-13))
                    }
                }
            }.frame(minHeight: 300).background(Color.black.opacity(0.35)).clipShape(RoundedRectangle(cornerRadius: 14)).clipped()
                .gesture(MagnificationGesture().onChanged { gestureZoom = $0 }.onEnded { zoom = min(4,max(0.5,zoom*$0)); gestureZoom = 1 })
                .accessibilityElement(children: .ignore).accessibilityLabel(strings.text("floorPlan"))
            HStack {
                drawButton("minus.magnifyingglass", "zoomOut") { zoom = max(0.5, zoom/1.25) }
                drawButton("plus.magnifyingglass", "zoomIn") { zoom = min(4, zoom*1.25) }
                drawButton("rotate.right", "rotatePlan") { rotation += .pi/2 }
                drawButton("arrow.counterclockwise", "resetView") { zoom = 1; rotation = 0 }
            }
            LazyVGrid(columns:[GridItem(.adaptive(minimum:130),alignment:.leading)],alignment:.leading) {
                ForEach(PlanLineStyle.legend,id:\.0) { key,kind in
                    HStack(spacing:8) {
                        Canvas { context,size in
                            var path = Path();path.move(to:CGPoint(x:0,y:size.height/2));path.addLine(to:CGPoint(x:size.width,y:size.height/2))
                            context.stroke(path,with:.color(PlanLineStyle.color(kind)),style:StrokeStyle(lineWidth:3,dash:PlanLineStyle.dash(kind)))
                        }.frame(width:26,height:20).accessibilityHidden(true)
                        Text(strings.text(key)).font(.caption)
                    }
                }
            }
        }
    }
    private func drawButton(_ image: String, _ key: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: image).frame(minWidth:44,minHeight:44) }.accessibilityLabel(strings.text(key))
    }
}
extension Color { static let lime = Color(red: 0.78, green: 0.98, blue: 0.16) }
enum PlanLineStyle {
    static let legend: [(String,PlanSegment.Kind)] = [("walls",.wall),("doors",.door),("windows",.window),("openings",.opening)]
    static func dash(_ kind: PlanSegment.Kind) -> [CGFloat] { switch kind { case .wall:return [];case .door:return [10,3];case .window:return [2,2];case .opening:return [6,4] } }
    static func color(_ kind: PlanSegment.Kind) -> Color { kind == .wall ? .lime : kind == .door ? .cyan : kind == .window ? .blue : .orange }
    static func pdfColor(_ kind: PlanSegment.Kind) -> UIColor { kind == .wall ? .black : kind == .door ? .systemTeal : kind == .window ? .systemBlue : .systemOrange }
}

enum PlanPDF {
    static func data(record: SavedFloorPlan, strings: ScannerStrings) throws -> Data {
        try record.validate()
        let page = CGRect(x:0,y:0,width:595,height:842)
        return UIGraphicsPDFRenderer(bounds: page).pdfData { renderer in
            func text(_ value: String, _ rect: CGRect, size: CGFloat = 11, bold: Bool = false) {
                (value as NSString).draw(in: rect, withAttributes: [.font: bold ? UIFont.boldSystemFont(ofSize:size) : UIFont.systemFont(ofSize:size), .foregroundColor: UIColor.black])
            }
            func heading() {
                renderer.beginPage()
                text(record.name, CGRect(x:28,y:24,width:539,height:60),size:22,bold:true)
                text(record.localProject,CGRect(x:28,y:85,width:539,height:36))
                text(strings.text(record.plan.source == .example ? "sampleBadge" : "measurementNotice"),CGRect(x:28,y:126,width:539,height:60),size:12,bold:true)
                text(strings.text("measurementNotice"),CGRect(x:28,y:761,width:539,height:60),size:10)
            }
            heading()
            let frame = CGRect(x:28,y:193,width:539,height:480)
            let projection = PlanProjection(plan:record.plan,frame:frame)
            let wallNumbers = Dictionary(uniqueKeysWithValues: record.plan.walls.enumerated().map { ($0.element.id,$0.offset+1) })
            let cg = renderer.cgContext
            for line in record.plan.segments {
                let a = projection.point(line.start), b = projection.point(line.end)
                cg.setStrokeColor(PlanLineStyle.pdfColor(line.kind).cgColor)
                cg.setLineWidth(line.kind == .wall ? 2 : 3); cg.setLineDash(phase:0,lengths:PlanLineStyle.dash(line.kind))
                cg.move(to:a);cg.addLine(to:b);cg.strokePath()
                if let number = wallNumbers[line.id] {
                    text(strings.text("wallLabel",["number":String(number),"length":strings.number(line.length)]),CGRect(x:(a.x+b.x)/2-65,y:(a.y+b.y)/2-19,width:130,height:22),size:10,bold:true)
                }
            }
            text(strings.text("drawingScale",["scale":strings.number(2834.645669/projection.scale)]),CGRect(x:28,y:684,width:539,height:30))
            for (i,pair) in PlanLineStyle.legend.enumerated() {
                let x = CGFloat(28+i*133)
                cg.setStrokeColor(PlanLineStyle.pdfColor(pair.1).cgColor);cg.setLineWidth(3);cg.setLineDash(phase:0,lengths:PlanLineStyle.dash(pair.1))
                cg.move(to:CGPoint(x:x,y:728));cg.addLine(to:CGPoint(x:x+24,y:728));cg.strokePath()
                text(strings.text(pair.0),CGRect(x:x+30,y:720,width:100,height:30),size:10)
            }
            // A separate paginated list keeps every dimension readable for complex rooms.
            heading(); text(strings.text("measurements"),CGRect(x:28,y:191,width:539,height:30),size:18,bold:true)
            var y: CGFloat = 238
            for (i, wall) in record.plan.walls.enumerated() {
                if y > 704 { heading(); y = 194 }
                text(strings.text("wallDimension",["number":String(i+1),"length":strings.number(wall.length)]),CGRect(x:28,y:y,width:539,height:28),size:12)
                y += 30
            }
        }
    }
}
