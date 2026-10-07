import AppKit
import CoreText

// Creates new marketing canvases around whole native captures. App pixels are
// never repainted, rearranged, cropped or replaced with generated UI.
guard CommandLine.arguments.count == 5 else {
    fatalError("Usage: ios-product-assets.swift ROOT OUTPUT LOCALE DEVICE")
}
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let locale = CommandLine.arguments[3]
let device = CommandLine.arguments[4]
let config = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("fastlane/product-assets-ios/copy.json"))) as! [String: [String: Any]]
guard let copy = config[locale], let slides = copy["slides"] as? [[String]] else { fatalError("Unsupported locale") }
let app = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("app.json"))) as! [String: Any]
let expo = app["expo"] as! [String: Any]
let ios = expo["ios"] as! [String: Any]
let build = ios["buildNumber"] as! String
let pad = device == "ipad-13"
guard pad || device == "iphone-medium" || device == "social" || device == "board" else { fatalError("Unsupported device") }
for file in ["manrope-400.ttf", "manrope-600.ttf", "manrope-700.ttf"] {
    CTFontManagerRegisterFontsForURL(root.appendingPathComponent("assets/fonts/\(file)") as CFURL, .process, nil)
}
let logo = NSImage(contentsOf: root.appendingPathComponent("assets/icon.png"))!
let navy = NSColor(red: 23/255, green: 43/255, blue: 83/255, alpha: 1)
let blue = NSColor(red: 36/255, green: 65/255, blue: 132/255, alpha: 1)
let muted = NSColor(red: 189/255, green: 205/255, blue: 237/255, alpha: 1)
func font(_ size: CGFloat, bold: Bool = false) -> NSFont {
    NSFont(name: bold ? "Manrope-Bold" : "Manrope-Regular", size: size) ?? .systemFont(ofSize: size, weight: bold ? .bold : .regular)
}
func topRect(_ canvas: NSSize, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: canvas.height-y-h, width: w, height: h)
}
func text(_ value: String, canvas: NSSize, x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat, size: CGFloat, bold: Bool = false, color: NSColor = .white, centered: Bool = false) {
    let style = NSMutableParagraphStyle()
    style.lineBreakMode = .byWordWrapping
    style.alignment = centered ? .center : .left
    style.lineSpacing = size * 0.07
    let attributes: [NSAttributedString.Key: Any] = [.font: font(size, bold: bold), .foregroundColor: color, .paragraphStyle: style]
    let measured = (value as NSString).boundingRect(with: NSSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
    guard measured.height <= height + 1 else { fatalError("Text overflows: \(locale) \(value), measured \(measured.height), limit \(height)") }
    (value as NSString).draw(in: topRect(canvas, x, top, width, height), withAttributes: attributes)
}
func background(_ size: NSSize) {
    NSGradient(starting: blue, ending: navy)!.draw(in: NSRect(origin: .zero, size: size), angle: -65)
    NSColor.white.withAlphaComponent(0.045).setStroke()
    for multiplier in [0.28, 0.42, 0.56] {
        let diameter = size.width * multiplier
        let ring = NSBezierPath(ovalIn: topRect(size, size.width*0.9-diameter/2, -diameter*0.2, diameter, diameter))
        ring.lineWidth = 2; ring.stroke()
    }
}
func canvas(_ size: NSSize, _ body: () -> Void, destination: URL) throws {
    let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: Int(size.width)*4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let prior = NSGraphicsContext.current
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.current?.imageInterpolation = .high
    background(size); body()
    NSGraphicsContext.current = prior
    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    try NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!.write(to: destination)
}
func capture(_ source: String, _ kind: String) throws -> NSImage {
    let file = root.appendingPathComponent("artifacts/publication/store-captures-\(build)/\(locale)/\(kind)/\(source).png")
    let bytes = try Data(contentsOf: file)
    guard let bitmap = NSBitmapImageRep(data: bytes), let image = NSImage(data: bytes) else { fatalError("Missing native capture") }
    let dimensions = kind == "ipad-13" ? (2064,2752) : (1206,2622)
    guard bitmap.pixelsWide == dimensions.0 && bitmap.pixelsHigh == dimensions.1 else { fatalError("Unexpected native display dimensions") }
    return image
}
func screen(_ image: NSImage, canvas: NSSize, x: CGFloat, top: CGFloat, width: CGFloat) {
    let height = width * image.size.height / image.size.width
    let rect = topRect(canvas, x, top, width, height)
    guard rect.minY >= 0 && rect.maxY <= canvas.height && rect.minX >= 0 && rect.maxX <= canvas.width else { fatalError("Native display would be cropped") }
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
    shadow.shadowBlurRadius = 42; shadow.shadowOffset = NSSize(width: 0, height: -12); shadow.set()
    NSColor.white.withAlphaComponent(0.18).setFill()
    NSBezierPath(roundedRect: rect.insetBy(dx: -12, dy: -12), xRadius: 28, yRadius: 28).fill()
    NSGraphicsContext.restoreGraphicsState()
    image.draw(in: rect)
}

if device == "board" {
    for kind in ["iphone-medium", "ipad-13"] {
        let size = NSSize(width:1800, height:kind == "iphone-medium" ? 1000 : 740)
        try canvas(size, {
            text("Mautic Inbox · \(locale) · \(kind == "iphone-medium" ? "iPhone" : "iPad")", canvas:size, x:60, top:45, width:1650, height:70, size:35, bold:true)
            for (index, slide) in slides.enumerated() {
                let file = output.appendingPathComponent("screenshots/\(locale)/\(kind)-\(slide[0]).png")
                let image = NSImage(contentsOf:file)!
                let width: CGFloat = 316
                let height = width * image.size.height / image.size.width
                image.draw(in:topRect(size,60+CGFloat(index)*340,150,width,height))
            }
            text("Native iOS UI · 1.0.0 (\(build)) · Local artwork preview", canvas:size, x:60, top:size.height-65, width:1600, height:45, size:25, color:muted)
        }, destination:output.appendingPathComponent("preview/\(locale)-\(kind).png"))
    }
} else if device == "social" {
    let image = try capture("01-conversas", "iphone-medium")
    for (name, size) in [("hero-1200x630", NSSize(width:1200,height:630)), ("social-1080x1350", NSSize(width:1080,height:1350))] {
        let vertical = size.height > size.width
        try canvas(size, {
            let margin: CGFloat = vertical ? 64 : 64
            logo.draw(in: topRect(size, margin, 50, 40, 40))
            text("Mautic Inbox", canvas:size, x:margin+56, top:50, width:500, height:50, size:30, bold:true)
            text(copy["hero"] as! String, canvas:size, x:margin, top:vertical ? 130 : 175, width:vertical ? 950 : 680, height:170, size:58, bold:true)
            text(copy["hero_body"] as! String, canvas:size, x:margin, top:vertical ? 315 : 370, width:vertical ? 950 : 685, height:85, size:vertical ? 30 : 26, color:muted)
            let width: CGFloat = vertical ? 374 : 244
            screen(image, canvas:size, x:vertical ? (size.width-width)/2 : 855, top:vertical ? 450 : 50, width:width)
            text(copy["footer"] as! String, canvas:size, x:margin, top:size.height-52, width:size.width-2*margin, height:34, size:vertical ? 24 : 18, color:muted)
        }, destination:output.appendingPathComponent("social/\(locale)/\(name).png"))
    }
} else {
    let size = pad ? NSSize(width:2064,height:2752) : NSSize(width:1206,height:2622)
    let margin: CGFloat = pad ? 148 : 88
    let imageTop: CGFloat = pad ? 680 : 625
    let imageHeight = size.height-imageTop-110
    let imageWidth = imageHeight * (pad ? 2064.0/2752.0 : 1206.0/2622.0)
    for (index, slide) in slides.enumerated() {
        let image = try capture(slide[1], device)
        try canvas(size, {
            logo.draw(in:topRect(size,margin,80,pad ? 62 : 50,pad ? 62 : 50))
            text("Mautic Inbox", canvas:size, x:margin+(pad ? 82 : 70), top:80, width:700, height:70, size:pad ? 44 : 35, bold:true)
            text(String(format:"%02d / 05",index+1), canvas:size, x:size.width-margin-150, top:85, width:150, height:50, size:pad ? 32 : 26, color:muted)
            text(slide[2], canvas:size, x:margin, top:pad ? 200 : 190, width:size.width-2*margin, height:60, size:pad ? 36 : 26, color:muted)
            text(slide[3], canvas:size, x:margin, top:pad ? 285 : 265, width:size.width-2*margin, height:pad ? 270 : 235, size:pad ? 94 : 78, bold:true)
            text(slide[4], canvas:size, x:margin, top:pad ? 560 : 510, width:size.width-2*margin, height:110, size:pad ? 39 : 31, color:muted)
            screen(image, canvas:size, x:(size.width-imageWidth)/2, top:imageTop, width:imageWidth)
            text(copy["footer"] as! String, canvas:size, x:margin, top:size.height-62, width:size.width-2*margin, height:42, size:pad ? 29 : 25, color:muted, centered:true)
        }, destination:output.appendingPathComponent("screenshots/\(locale)/\(device)-\(slide[0]).png"))
    }
}
print("Created \(device) marketing assets for \(locale), native build \(build).")
