#!/usr/bin/env swift

import AppKit
import Foundation

struct Palette {
    let accent: NSColor
    let glow: NSColor
}

struct ScreenshotSpec {
    let file: String
    let eyebrow: String
    let headline: String
    let body: String
    let palette: Palette
}

let arguments = CommandLine.arguments
guard arguments.count == 5 else {
    fputs("Usage: frame_store_screenshots.swift SOURCE_DIR OUTPUT_DIR LANGUAGE DEVICE\n", stderr)
    exit(2)
}

let sourceDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let outputDirectory = URL(fileURLWithPath: arguments[2], isDirectory: true)
let language = arguments[3]
let device = arguments[4]
guard ["iPhone-6.9", "iPhone-medium", "iPad-13"].contains(device) else {
    fputs("Unsupported display class\n", stderr)
    exit(2)
}

let blue = Palette(
    accent: NSColor(calibratedRed: 0.14, green: 0.255, blue: 0.518, alpha: 1),
    glow: NSColor(calibratedRed: 0.35, green: 0.51, blue: 0.80, alpha: 1)
)
let purple = Palette(
    accent: NSColor(calibratedRed: 0.45, green: 0.19, blue: 0.93, alpha: 1),
    glow: NSColor(calibratedRed: 0.72, green: 0.52, blue: 1.00, alpha: 1)
)
let orange = Palette(
    accent: NSColor(calibratedRed: 0.96, green: 0.38, blue: 0.08, alpha: 1),
    glow: NSColor(calibratedRed: 1.00, green: 0.72, blue: 0.26, alpha: 1)
)
let teal = Palette(
    accent: NSColor(calibratedRed: 0.00, green: 0.50, blue: 0.46, alpha: 1),
    glow: NSColor(calibratedRed: 0.30, green: 0.88, blue: 0.72, alpha: 1)
)
let green = Palette(
    accent: NSColor(calibratedRed: 0.08, green: 0.58, blue: 0.30, alpha: 1),
    glow: NSColor(calibratedRed: 0.48, green: 0.88, blue: 0.48, alpha: 1)
)

// Frames only real captures. The app UI is never recreated by this renderer.
let portugueseSpecs: [ScreenshotSpec] = [
    .init(file: "01-conversas.png", eyebrow: "ATENDIMENTO MULTICANAL", headline: "Cada conversa,\nno lugar certo", body: "Organize canais e filas\nna sua conta Mautic.", palette: blue),
    .init(file: "02-chat.png", eyebrow: "CONVERSAS QUE AVANÇAM", headline: "Responda com\nmais contexto", body: "Histórico, notas internas\ne atendimento na mesma tela.", palette: blue),
    .init(file: "03-comentarios.png", eyebrow: "COMENTÁRIOS E MODERAÇÃO", headline: "Cuide também\ndas redes sociais", body: "Acompanhe comentários e use\na moderação do seu atendimento.", palette: blue),
    .init(file: "04-assistente.png", eyebrow: "SEU MAUTIC, MAIS PERTO", headline: "Consulte pelo\nassistente", body: "Campanhas e contatos com\nas permissões da sua conta.", palette: blue),
    .init(file: "05-conexoes.png", eyebrow: "MAIS DE UMA INSTÂNCIA", headline: "Seus Mautics.\nUm aplicativo.", body: "Configure URL e autenticação\npela tela de conexões.", palette: blue)
]

let englishSpecs: [ScreenshotSpec] = [
    .init(file: "01-conversas.png", eyebrow: "MULTICHANNEL SUPPORT", headline: "Every conversation,\nin the right place", body: "Organize channels and queues\nin your Mautic account.", palette: blue),
    .init(file: "02-chat.png", eyebrow: "KEEP CONVERSATIONS MOVING", headline: "Reply with\nmore context", body: "History, internal notes and\nsupport on the same screen.", palette: blue),
    .init(file: "03-comentarios.png", eyebrow: "COMMENTS AND MODERATION", headline: "Care for your\nsocial channels", body: "Follow comments and use\nyour support moderation tools.", palette: blue),
    .init(file: "04-assistente.png", eyebrow: "YOUR MAUTIC, CLOSER", headline: "Ask your\nassistant", body: "Campaigns and contacts with\nyour account permissions.", palette: blue),
    .init(file: "05-conexoes.png", eyebrow: "MORE THAN ONE INSTANCE", headline: "Your Mautics.\nOne app.", body: "Set the URL and sign in\nfrom the connections screen.", palette: blue)
]
let spanishSpecs: [ScreenshotSpec] = [
    .init(file: "01-conversas.png", eyebrow: "ATENCIÓN MULTICANAL", headline: "Cada conversación,\nen su lugar", body: "Organiza canales y colas\nen tu cuenta de Mautic.", palette: blue),
    .init(file: "02-chat.png", eyebrow: "CONVERSACIONES QUE AVANZAN", headline: "Responde con\nmás contexto", body: "Historial, notas internas y\natención en la misma pantalla.", palette: blue),
    .init(file: "03-comentarios.png", eyebrow: "COMENTARIOS Y MODERACIÓN", headline: "Cuida también\ntus redes sociales", body: "Sigue comentarios y usa\nlas herramientas de moderación.", palette: blue),
    .init(file: "04-assistente.png", eyebrow: "TU MAUTIC, MÁS CERCA", headline: "Consulta a tu\nasistente", body: "Campañas y contactos con\nlos permisos de tu cuenta.", palette: blue),
    .init(file: "05-conexoes.png", eyebrow: "MÁS DE UNA INSTANCIA", headline: "Tus Mautics.\nUna aplicación.", body: "Configura la URL y el acceso\ndesde la pantalla de conexiones.", palette: blue)
]
let localizedSpecs = ["pt-BR": portugueseSpecs, "en-US": englishSpecs, "es-ES": spanishSpecs]
guard let specs = localizedSpecs[language] else {
    fputs("Unsupported store language\n", stderr)
    exit(2)
}
let captureLabel = [
    "pt-BR": "Tela real do aplicativo · Dados de demonstração",
    "en-US": "Actual app screen · Demo data",
    "es-ES": "Pantalla real de la aplicación · Datos de demostración"
][language]!

let isPad = device == "iPad-13"
let isMedium = device == "iPhone-medium"
let canvasSize = isPad ? NSSize(width: 2064, height: 2752) : isMedium ? NSSize(width: 1206, height: 2622) : NSSize(width: 1320, height: 2868)
let sideInset: CGFloat = isPad ? 150 : 96
let screenWidth: CGFloat = isPad ? 1500 : isMedium ? 880 : 1000
let deviceTop: CGFloat = isPad ? 630 : 630
let bezel: CGFloat = isPad ? 22 : 18
let cornerRadius: CGFloat = isPad ? 62 : 72

let navy = NSColor(calibratedRed: 0.045, green: 0.075, blue: 0.14, alpha: 1)
let secondaryText = NSColor(calibratedRed: 0.23, green: 0.27, blue: 0.35, alpha: 1)

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func rectFromTop(x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat) -> NSRect {
    NSRect(x: x, y: canvasSize.height - top - height, width: width, height: height)
}

func drawText(
    _ text: String,
    rect: NSRect,
    font: NSFont,
    color: NSColor,
    lineSpacing: CGFloat = 0,
    kern: CGFloat = 0
) {
    let style = NSMutableParagraphStyle()
    style.alignment = .left
    style.lineSpacing = lineSpacing
    style.lineBreakMode = .byWordWrapping
    (text as NSString).draw(
        in: rect,
        withAttributes: [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: style,
            .kern: kern
        ]
    )
}

func fillRoundedRect(_ rect: NSRect, radius: CGFloat, color: NSColor) {
    color.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func drawBackground(_ palette: Palette) {
    let paleAccent = palette.accent.blended(withFraction: 0.88, of: .white) ?? .white
    let paleGlow = palette.glow.blended(withFraction: 0.91, of: .white) ?? .white
    NSGradient(colors: [paleAccent, .white, paleGlow])!
        .draw(in: NSRect(origin: .zero, size: canvasSize), angle: -38)

    let topOrb = rectFromTop(
        x: canvasSize.width * 0.64,
        top: isPad ? -180 : -120,
        width: canvasSize.width * 0.62,
        height: canvasSize.width * 0.62
    )
    palette.glow.withAlphaComponent(0.12).setFill()
    NSBezierPath(ovalIn: topOrb).fill()

    let lowerOrb = NSRect(
        x: -canvasSize.width * 0.18,
        y: -canvasSize.width * 0.12,
        width: canvasSize.width * 0.62,
        height: canvasSize.width * 0.62
    )
    palette.accent.withAlphaComponent(0.07).setFill()
    NSBezierPath(ovalIn: lowerOrb).fill()
}

func drawBrand() {
    let pill = rectFromTop(
        x: sideInset,
        top: isPad ? 72 : 78,
        width: isPad ? 338 : 318,
        height: isPad ? 68 : 64
    )

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.07)
    shadow.shadowBlurRadius = 22
    shadow.shadowOffset = NSSize(width: 0, height: -6)
    shadow.set()
    fillRoundedRect(pill, radius: pill.height / 2, color: NSColor.white.withAlphaComponent(0.90))
    NSGraphicsContext.restoreGraphicsState()

    let label = rectFromTop(
        x: pill.minX + (isPad ? 26 : 23),
        top: isPad ? 88 : 93,
        width: pill.width - 40,
        height: 40
    )
    drawText(
        "MAUTIC INBOX",
        rect: label,
        font: .systemFont(ofSize: isPad ? 27 : 25, weight: .bold),
        color: navy,
        kern: 1.8
    )
}

for spec in specs {
    let inputURL = sourceDirectory.appendingPathComponent(spec.file)
    guard let screenshot = NSImage(contentsOf: inputURL), screenshot.size.width > 0 else {
        fputs("Missing screenshot: \(inputURL.path)\n", stderr)
        exit(1)
    }

    let capture = NSBitmapImageRep(data: try Data(contentsOf: inputURL))
    let acceptedDimensions = isPad ? [(2064,2752),(2048,2732)] : isMedium ? [(1206,2622),(1179,2556)] : [(1320,2868),(1290,2796),(1260,2736)]
    guard let capture, acceptedDimensions.contains(where: {$0.0 == capture.pixelsWide && $0.1 == capture.pixelsHigh}) else {
        fputs("Capture is not from the required display class: \(inputURL.path)\n", stderr)
        exit(1)
    }

    let pixelWidth = Int(canvasSize.width)
    let pixelHeight = Int(canvasSize.height)
    guard let bitmapContext = CGContext(
        data: nil,
        width: pixelWidth,
        height: pixelHeight,
        bitsPerComponent: 8,
        bytesPerRow: pixelWidth * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else {
        fputs("Could not create bitmap for \(spec.file)\n", stderr)
        exit(1)
    }

    let drawingContext = NSGraphicsContext(cgContext: bitmapContext, flipped: false)
    let previousContext = NSGraphicsContext.current
    NSGraphicsContext.current = drawingContext

    drawBackground(spec.palette)
    drawBrand()

    let eyebrowWidth = isPad ? 470 : 390
    let eyebrow = rectFromTop(
        x: sideInset,
        top: isPad ? 182 : 176,
        width: CGFloat(eyebrowWidth),
        height: isPad ? 54 : 50
    )
    fillRoundedRect(
        eyebrow,
        radius: eyebrow.height / 2,
        color: spec.palette.accent.withAlphaComponent(0.11)
    )
    drawText(
        spec.eyebrow,
        rect: rectFromTop(
            x: eyebrow.minX + (isPad ? 25 : 21),
            top: isPad ? 194 : 188,
            width: eyebrow.width - 40,
            height: 31
        ),
        font: .systemFont(ofSize: isPad ? 23 : 21, weight: .bold),
        color: spec.palette.accent,
        kern: 1.3
    )

    drawText(
        spec.headline,
        rect: rectFromTop(
            x: sideInset,
            top: isPad ? 255 : 248,
            width: canvasSize.width - sideInset * 2,
            height: isPad ? 205 : 195
        ),
        font: .systemFont(ofSize: isPad ? 74 : 66, weight: .heavy),
        color: navy,
        lineSpacing: isPad ? -6 : -5,
        kern: -1.2
    )

    drawText(
        spec.body,
        rect: rectFromTop(
            x: sideInset,
            top: isPad ? 475 : 466,
            width: canvasSize.width - sideInset * 2,
            height: isPad ? 105 : 108
        ),
        font: .systemFont(ofSize: isPad ? 30 : 28, weight: .medium),
        color: secondaryText,
        lineSpacing: 4
    )

    drawText(
        captureLabel,
        rect: rectFromTop(x: sideInset, top: 590, width: canvasSize.width - sideInset * 2, height: 32),
        font: .systemFont(ofSize: isPad ? 22 : 20, weight: .medium),
        color: secondaryText
    )

    let scale = screenWidth / screenshot.size.width
    let screenHeight = screenshot.size.height * scale
    let screenX = (canvasSize.width - screenWidth) / 2
    let screenRect = rectFromTop(x: screenX, top: deviceTop + bezel, width: screenWidth, height: screenHeight)
    let deviceRect = rectFromTop(
        x: screenX - bezel,
        top: deviceTop,
        width: screenWidth + bezel * 2,
        height: screenHeight + bezel * 2
    )

    let glowRect = deviceRect.insetBy(dx: isPad ? -46 : -36, dy: isPad ? -46 : -36)
    fillRoundedRect(
        glowRect,
        radius: cornerRadius + 30,
        color: spec.palette.accent.withAlphaComponent(0.08)
    )

    NSGraphicsContext.saveGraphicsState()
    let deviceShadow = NSShadow()
    deviceShadow.shadowColor = navy.withAlphaComponent(0.24)
    deviceShadow.shadowBlurRadius = isPad ? 55 : 46
    deviceShadow.shadowOffset = NSSize(width: 0, height: -16)
    deviceShadow.set()
    fillRoundedRect(deviceRect, radius: cornerRadius, color: navy)
    NSGraphicsContext.restoreGraphicsState()

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(
        roundedRect: screenRect,
        xRadius: cornerRadius - bezel,
        yRadius: cornerRadius - bezel
    ).addClip()
    NSGraphicsContext.current?.imageInterpolation = .high
    screenshot.draw(in: screenRect, from: .zero, operation: .sourceOver, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()

    NSColor.white.withAlphaComponent(0.25).setStroke()
    let rim = NSBezierPath(roundedRect: deviceRect, xRadius: cornerRadius, yRadius: cornerRadius)
    rim.lineWidth = isPad ? 3 : 2
    rim.stroke()

    NSGraphicsContext.current = previousContext

    guard let renderedImage = bitmapContext.makeImage() else {
        fputs("Could not finalize \(spec.file)\n", stderr)
        exit(1)
    }
    let bitmap = NSBitmapImageRep(cgImage: renderedImage)
    guard let pngData = bitmap.representation(using: .png, properties: [.compressionFactor: 0.94]) else {
        fputs("Could not render \(spec.file)\n", stderr)
        exit(1)
    }

    let outputName = "\(device)-\(spec.file)"
    try pngData.write(to: outputDirectory.appendingPathComponent(outputName), options: .atomic)
    print("Rendered \(outputName)")
}
