import AppKit
import CoreText

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let icon = NSImage(contentsOf: root.appendingPathComponent("assets/icon.png"))!
for file in ["manrope-400.ttf", "manrope-700.ttf"] {
    CTFontManagerRegisterFontsForURL(root.appendingPathComponent("assets/fonts/\(file)") as CFURL, .process, nil)
}
func face(_ size: CGFloat, bold: Bool = false) -> NSFont {
    NSFont(name: bold ? "Manrope-Bold" : "Manrope-Regular", size: size) ?? NSFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
}
let content: [String: (String, String)] = [
    "pt-BR": ("Seu atendimento.\nEm um só lugar.", "WhatsApp · Web Chat · Comentários"),
    "en-US": ("Your conversations.\nOne place to help.", "WhatsApp · Web Chat · Comments"),
    "es-ES": ("Tu atención.\nEn un solo lugar.", "WhatsApp · Web Chat · Comentarios")
]
func render(_ width: Int, _ height: Int, at path: URL, alpha: Bool = false, draw: () -> Void) throws {
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: alpha ? CGImageAlphaInfo.premultipliedLast.rawValue : CGImageAlphaInfo.noneSkipLast.rawValue)!
    let previous = NSGraphicsContext.current
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    draw(); NSGraphicsContext.current = previous
    try FileManager.default.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
    try NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!.write(to: path)
}
for (locale, copy) in content {
    let folder = root.appendingPathComponent("fastlane/android-metadata/\(locale)/images")
    // Play icon: 32-bit RGBA. Feature graphics: 24-bit RGB.
    try render(512, 512, at: folder.appendingPathComponent("icon.png"), alpha: true) {
        icon.draw(in: NSRect(x: 0, y: 0, width: 512, height: 512))
    }
    try render(1024, 500, at: folder.appendingPathComponent("featureGraphic.png")) {
        NSGradient(starting: NSColor(red: 36/255, green: 65/255, blue: 132/255, alpha: 1),
                   ending: NSColor(red: 23/255, green: 43/255, blue: 83/255, alpha: 1))!.draw(in: NSRect(x: 0, y: 0, width: 1024, height: 500), angle: -20)
        NSColor.white.withAlphaComponent(0.055).setStroke()
        for diameter in [280, 420, 560] {
            let path = NSBezierPath(ovalIn: NSRect(x: 810 - diameter / 2, y: 255 - diameter / 2, width: diameter, height: diameter))
            path.lineWidth = 1.5; path.stroke()
        }
        ("Mautic Inbox" as NSString).draw(at: NSPoint(x: 80, y: 382), withAttributes: [.font: face(24, bold: true), .foregroundColor: NSColor.white.withAlphaComponent(0.8)])
        let style = NSMutableParagraphStyle(); style.lineSpacing = 0
        (copy.0 as NSString).draw(in: NSRect(x: 80, y: 201, width: 570, height: 150), withAttributes: [.font: face(51, bold: true), .foregroundColor: NSColor.white, .paragraphStyle: style])
        (copy.1 as NSString).draw(at: NSPoint(x: 82, y: 146), withAttributes: [.font: face(22), .foregroundColor: NSColor.white.withAlphaComponent(0.75)])
        // Abstract conversation mark, separate from the actual app screenshots.
        NSColor.white.withAlphaComponent(0.12).setFill()
        NSBezierPath(roundedRect: NSRect(x: 691, y: 236, width: 230, height: 152), xRadius: 40, yRadius: 40).fill()
        let tail = NSBezierPath(); tail.move(to: NSPoint(x: 705, y: 264)); tail.line(to: NSPoint(x: 689, y: 212)); tail.line(to: NSPoint(x: 752, y: 248)); tail.close(); tail.fill()
        NSColor.white.withAlphaComponent(0.92).setStroke()
        let front = NSBezierPath(roundedRect: NSRect(x: 655, y: 137, width: 214, height: 146), xRadius: 36, yRadius: 36)
        front.lineWidth = 4; front.stroke()
        NSColor.white.withAlphaComponent(0.92).setFill()
        for x in [716, 759, 802] { NSBezierPath(ovalIn: NSRect(x: x, y: 202, width: 14, height: 14)).fill() }
    }
}
print("Localized feature graphics and 32-bit Google Play icons generated.")
