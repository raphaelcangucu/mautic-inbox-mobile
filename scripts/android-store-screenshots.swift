import AppKit
import CoreText

// Store artwork uses whole, unmodified physical Android screenshots.
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let locale = CommandLine.arguments[2]
let configuration = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("app.json"))) as! [String: Any]
let expo = configuration["expo"] as! [String: Any]
let android = expo["android"] as! [String: Any]
let code = android["versionCode"] as! Int
for file in ["manrope-400.ttf", "manrope-600.ttf", "manrope-700.ttf"] {
    CTFontManagerRegisterFontsForURL(root.appendingPathComponent("assets/fonts/\(file)") as CFURL, .process, nil)
}
func face(_ size: CGFloat, bold: Bool = false) -> NSFont {
    return NSFont(name: bold ? "Manrope-Bold" : "Manrope-Regular", size: size) ?? NSFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
}
let titles: [String: [String]] = [
    "pt-BR": ["Conversas em um só lugar", "Mais espaço para conversar", "Comentários organizados", "Seu assistente no Mautic", "Conecte suas instâncias"],
    "en-US": ["Conversations in one place", "More room for conversations", "Keep comments organized", "Your Mautic assistant", "Connect your instances"],
    "es-ES": ["Conversaciones en un lugar", "Más espacio para conversar", "Comentarios organizados", "Tu asistente de Mautic", "Conecta tus instancias"]
]
let footers = ["pt-BR": "Tela real do app · Dados de demonstração", "en-US": "Actual app screen · Demo data", "es-ES": "Pantalla real de la app · Datos de demostración"]
guard let localizedTitles = titles[locale], let footer = footers[locale] else { fatalError("Unsupported locale") }
let files = ["01-conversas", "02-chat", "03-comentarios", "04-assistente", "05-conexoes"]
let logo = NSImage(contentsOf: root.appendingPathComponent("assets/icon.png"))!
for (index, name) in files.enumerated() {
    let source = root.appendingPathComponent("artifacts/publication/android-store-captures-\(code)/\(locale)/phone/\(name).png")
    let sourceBytes = try Data(contentsOf: source)
    guard let bitmap = NSBitmapImageRep(data: sourceBytes), bitmap.pixelsWide == 1080, bitmap.pixelsHigh == 2400,
          let image = NSImage(data: sourceBytes) else { fatalError("Unexpected physical-device screenshot") }
    let context = CGContext(data: nil, width: 1080, height: 1920, bitsPerComponent: 8,
        bytesPerRow: 1080 * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let previous = NSGraphicsContext.current
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    NSGradient(starting: NSColor(red: 36/255, green: 65/255, blue: 132/255, alpha: 1),
               ending: NSColor(red: 23/255, green: 43/255, blue: 83/255, alpha: 1))!.draw(in: NSRect(x: 0, y: 0, width: 1080, height: 1920), angle: -65)
    // The graphic motif is outside the app pixels and repeats the brand's curves.
    NSColor.white.withAlphaComponent(0.07).setStroke()
    for diameter in [380, 550, 720] {
        let ring = NSBezierPath(ovalIn: NSRect(x: 815 - diameter / 2, y: 1790 - diameter / 2, width: diameter, height: diameter))
        ring.lineWidth = 2; ring.stroke()
    }
    logo.draw(in: NSRect(x: 64, y: 1844, width: 38, height: 38))
    ("Mautic Inbox" as NSString).draw(at: NSPoint(x: 118, y: 1846), withAttributes: [.font: face(27, bold: true), .foregroundColor: NSColor.white])
    (String(format: "%02d / 05", index + 1) as NSString).draw(at: NSPoint(x: 930, y: 1850), withAttributes: [.font: face(23), .foregroundColor: NSColor.white.withAlphaComponent(0.65)])
    let title = localizedTitles[index] as NSString
    var titleSize: CGFloat = 64
    while title.size(withAttributes: [.font: face(titleSize, bold: true)]).width > 952 { titleSize -= 1 }
    title.draw(at: NSPoint(x: 64, y: 1745), withAttributes: [.font: face(titleSize, bold: true), .foregroundColor: NSColor.white])
    // Whole native display retained with uniform scale: 720 × 1600.
    NSGraphicsContext.current?.imageInterpolation = .high
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.25)
    shadow.shadowOffset = NSSize(width: 0, height: -10); shadow.shadowBlurRadius = 30; shadow.set()
    NSColor.white.setFill(); NSRect(x: 180, y: 90, width: 720, height: 1600).fill()
    NSGraphicsContext.restoreGraphicsState()
    image.draw(in: NSRect(x: 180, y: 90, width: 720, height: 1600))
    let style = NSMutableParagraphStyle(); style.alignment = .center
    (footer as NSString).draw(in: NSRect(x: 40, y: 30, width: 1000, height: 32), withAttributes: [.font: face(21), .foregroundColor: NSColor.white.withAlphaComponent(0.65), .paragraphStyle: style])
    NSGraphicsContext.current = previous
    let output = root.appendingPathComponent("fastlane/android-metadata/\(locale)/images/phoneScreenshots/\(name).png")
    try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    try NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!.write(to: output)
}
print("Rendered 5 branded store images for \(locale) using physical Android build \(code).")
