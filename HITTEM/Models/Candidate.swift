import Foundation

/// A single card in the deck: a contact merged with any prior decision.
struct Candidate: Identifiable, Equatable {
    let id: String          // CNContact.identifier
    let name: String
    let phoneNumber: String
    let phoneLabel: String
    var lastActionDate: Date?
    var lastOutcome: ContactOutcome?

    static func == (lhs: Candidate, rhs: Candidate) -> Bool { lhs.id == rhs.id }
}
