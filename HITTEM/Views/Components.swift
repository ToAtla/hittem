import SwiftUI

struct CircleButton: ButtonStyle {
    let color: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 28, weight: .bold))
            .foregroundStyle(color)
            .frame(width: 72, height: 72)
            .background(Circle().fill(.background).shadow(radius: 6))
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}
