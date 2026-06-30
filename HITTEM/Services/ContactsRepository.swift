import Foundation
import Contacts

struct RawContact: Identifiable {
    let id: String
    let name: String
    let phoneNumber: String
    let phoneLabel: String
}

enum ContactsAuth {
    case notDetermined
    case denied
    case authorized
    case restricted
}

/// Thin wrapper over the system Contacts store.
final class ContactsRepository {
    private let store = CNContactStore()

    func authorizationStatus() -> ContactsAuth {
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .authorized: return .authorized
        case .notDetermined: return .notDetermined
        case .restricted: return .restricted
        case .denied: return .denied
        default: return .authorized   // .limited (iOS 18+): a usable subset
        }
    }

    func requestAccess() async -> Bool {
        do {
            return try await store.requestAccess(for: .contacts)
        } catch {
            return false
        }
    }

    func fetchContacts() throws -> [RawContact] {
        let keys: [CNKeyDescriptor] = [
            CNContactFormatter.descriptorForRequiredKeys(for: .fullName),
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor
        ]
        let request = CNContactFetchRequest(keysToFetch: keys)
        let formatter = CNContactFormatter()
        formatter.style = .fullName

        var result: [RawContact] = []
        try store.enumerateContacts(with: request) { contact, _ in
            guard let phone = contact.phoneNumbers.first else { return }

            var name = formatter.string(from: contact) ?? ""
            if name.isEmpty { name = contact.organizationName }
            if name.isEmpty { name = phone.value.stringValue }

            let label = phone.label.map {
                CNLabeledValue<NSString>.localizedString(forLabel: $0)
            } ?? "phone"

            result.append(RawContact(id: contact.identifier,
                                     name: name,
                                     phoneNumber: phone.value.stringValue,
                                     phoneLabel: label))
        }
        return result
    }
}
