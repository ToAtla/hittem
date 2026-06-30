import SwiftUI

struct DeckView: View {
    @Bindable var store: DeckStore

    private let visibleCount = 3

    var body: some View {
        VStack {
            header
            ZStack {
                ForEach(Array(store.candidates.prefix(visibleCount).enumerated()), id: \.element.id) { item in
                    card(index: item.offset, candidate: item.element)
                }
            }
            .padding(24)
            Spacer()
            footer
        }
    }

    @ViewBuilder
    private func card(index: Int, candidate: Candidate) -> some View {
        CardView(
            candidate: candidate,
            isTop: index == 0,
            onSwipeRight: { store.swipeRight(candidate) },
            onSwipeLeft: { store.swipeLeft(candidate) }
        )
        .scaleEffect(1 - CGFloat(index) * 0.04)
        .offset(y: CGFloat(index) * 12)
        .zIndex(Double(visibleCount - index))
        .allowsHitTesting(index == 0)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("HITTEM").font(.largeTitle.bold())
            Text("\(store.candidates.count) to go")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top)
    }

    private var footer: some View {
        HStack(spacing: 48) {
            Button { if let c = store.candidates.first { store.swipeLeft(c) } } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(CircleButton(color: .secondary))

            Button { if let c = store.candidates.first { store.swipeRight(c) } } label: {
                Image(systemName: "phone.fill")
            }
            .buttonStyle(CircleButton(color: .green))
        }
        .padding(.bottom, 32)
    }
}
