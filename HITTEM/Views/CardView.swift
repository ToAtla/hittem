import SwiftUI

struct CardView: View {
    let candidate: Candidate
    let isTop: Bool
    let onSwipeRight: () -> Void
    let onSwipeLeft: () -> Void

    @State private var offset: CGSize = .zero
    private let threshold: CGFloat = 120

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(.background)
                .shadow(color: .black.opacity(0.15), radius: 16, y: 8)

            VStack(spacing: 16) {
                Circle()
                    .fill(.tint.opacity(0.15))
                    .frame(width: 132, height: 132)
                    .overlay(
                        Text(initials)
                            .font(.system(size: 44, weight: .semibold))
                            .foregroundStyle(.tint)
                    )
                Text(candidate.name)
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                Text("\(candidate.phoneLabel) · \(candidate.phoneNumber)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                subtitle
            }
            .padding(28)
        }
        .overlay(alignment: .topLeading) {
            stamp("CALL", .green, opacity: Double(max(0, offset.width) / threshold))
                .rotationEffect(.degrees(-12))
                .padding(28)
        }
        .overlay(alignment: .topTrailing) {
            stamp("SKIP", .red, opacity: Double(max(0, -offset.width) / threshold))
                .rotationEffect(.degrees(12))
                .padding(28)
        }
        .frame(maxWidth: .infinity, minHeight: 480, maxHeight: 520)
        .offset(offset)
        .rotationEffect(.degrees(Double(offset.width / 22)))
        .gesture(isTop ? drag : nil)
        .animation(.spring(duration: 0.3), value: offset)
    }

    private var drag: some Gesture {
        DragGesture()
            .onChanged { offset = $0.translation }
            .onEnded { value in
                if value.translation.width > threshold {
                    offset = CGSize(width: 700, height: value.translation.height)
                    onSwipeRight()
                } else if value.translation.width < -threshold {
                    offset = CGSize(width: -700, height: value.translation.height)
                    onSwipeLeft()
                } else {
                    offset = .zero
                }
            }
    }

    @ViewBuilder
    private var subtitle: some View {
        if let last = candidate.lastActionDate {
            Text("Last action \(last.formatted(.relative(presentation: .named)))")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        } else {
            Text("Not yet contacted in HITTEM")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
    }

    private func stamp(_ label: String, _ color: Color, opacity: Double) -> some View {
        Text(label)
            .font(.system(size: 28, weight: .heavy))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(color, lineWidth: 4))
            .opacity(min(1, opacity))
    }

    private var initials: String {
        let chars = candidate.name.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(chars).uppercased()
        return result.isEmpty ? "?" : result
    }
}
