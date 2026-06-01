module noflake::noflake;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const SETTLEMENT_MODE_STRICT: u8 = 0;
const SETTLEMENT_MODE_PARTY: u8 = 1;

const STATUS_OPEN: u8 = 0;
const STATUS_FULL: u8 = 1;
const STATUS_SETTLED: u8 = 4;

const RESERVATION_RESERVED: u8 = 0;
const RESERVATION_CANCELLED: u8 = 1;
const RESERVATION_CHECKED_IN_REFUNDED: u8 = 2;

const E_INVALID_DEPOSIT: u64 = 0;
const E_INVALID_SEATS: u64 = 1;
const E_INVALID_TIME: u64 = 2;
const E_INVALID_MODE: u64 = 3;
const E_EVENT_CLOSED: u64 = 4;
const E_EVENT_FULL: u64 = 5;
const E_DEPOSIT_MISMATCH: u64 = 6;
const E_NOT_HOST: u64 = 7;
const E_WRONG_EVENT: u64 = 8;
const E_INVALID_RESERVATION_STATUS: u64 = 9;
const E_DUPLICATE_RESERVATION: u64 = 10;

public struct Event has key, store {
    id: UID,
    host: address,
    title: String,
    start_ms: u64,
    end_ms: u64,
    deposit_amount: u64,
    seat_count: u64,
    reserved_count: u64,
    checked_in_count: u64,
    checked_in_attendees: vector<address>,
    registered_attendees: vector<address>,
    settlement_mode: u8,
    status: u8,
    created_at_ms: u64,
}

public struct EventVault<phantom T> has key, store {
    id: UID,
    event_id: ID,
    balance: Balance<T>,
}

public struct Reservation has key, store {
    id: UID,
    event_id: ID,
    attendee: address,
    deposit_amount: u64,
    status: u8,
    created_at_ms: u64,
    checked_in_at_ms: u64,
}

public struct SettlementReceipt has key, store {
    id: UID,
    event_id: ID,
    total_reserved: u64,
    total_checked_in: u64,
    total_no_show: u64,
    checked_in_refunded_amount: u64,
    forfeited_amount: u64,
    distributed_amount: u64,
    settled_at_ms: u64,
}

public struct EventCreated has copy, drop {
    event_id: ID,
    vault_id: ID,
    host: address,
    title: String,
    deposit_amount: u64,
    seat_count: u64,
    settlement_mode: u8,
}

public struct ReservationCreated has copy, drop {
    event_id: ID,
    reservation_id: ID,
    attendee: address,
    deposit_amount: u64,
}

public struct CheckedInAndRefunded has copy, drop {
    event_id: ID,
    reservation_id: ID,
    attendee: address,
    refund_amount: u64,
}

public struct ReservationCancelled has copy, drop {
    event_id: ID,
    reservation_id: ID,
    attendee: address,
    refund_amount: u64,
}

public struct EventSettled has copy, drop {
    event_id: ID,
    receipt_id: ID,
    total_reserved: u64,
    total_checked_in: u64,
    total_no_show: u64,
    forfeited_amount: u64,
    distributed_amount: u64,
}

public fun settlement_mode_strict(): u8 {
    SETTLEMENT_MODE_STRICT
}

public fun settlement_mode_party(): u8 {
    SETTLEMENT_MODE_PARTY
}

public fun reserved_count(event: &Event): u64 {
    event.reserved_count
}

public fun vault_balance<T>(vault: &EventVault<T>): u64 {
    vault.balance.value()
}

public fun checked_in_count(event: &Event): u64 {
    event.checked_in_count
}

public fun reservation_status(reservation: &Reservation): u8 {
    reservation.status
}

public fun reservation_status_checked_in_refunded(): u8 {
    RESERVATION_CHECKED_IN_REFUNDED
}

public fun reservation_status_cancelled(): u8 {
    RESERVATION_CANCELLED
}

public fun event_status(event: &Event): u8 {
    event.status
}

public fun event_status_settled(): u8 {
    STATUS_SETTLED
}

public fun receipt_forfeited_amount(receipt: &SettlementReceipt): u64 {
    receipt.forfeited_amount
}

public fun receipt_distributed_amount(receipt: &SettlementReceipt): u64 {
    receipt.distributed_amount
}

public fun create_event<T>(
    title: String,
    start_ms: u64,
    end_ms: u64,
    deposit_amount: u64,
    seat_count: u64,
    settlement_mode: u8,
    ctx: &mut TxContext,
) {
    assert!(deposit_amount > 0, E_INVALID_DEPOSIT);
    assert!(seat_count > 0, E_INVALID_SEATS);
    assert!(start_ms < end_ms, E_INVALID_TIME);
    assert!(
        settlement_mode == SETTLEMENT_MODE_STRICT || settlement_mode == SETTLEMENT_MODE_PARTY,
        E_INVALID_MODE,
    );

    let id = object::new(ctx);
    let event_id = object::uid_to_inner(&id);
    let host = tx_context::sender(ctx);

    let event = Event {
        id,
        host,
        title,
        start_ms,
        end_ms,
        deposit_amount,
        seat_count,
        reserved_count: 0,
        checked_in_count: 0,
        checked_in_attendees: vector[],
        registered_attendees: vector[],
        settlement_mode,
        status: STATUS_OPEN,
        created_at_ms: 0,
    };

    let vault = EventVault<T> {
        id: object::new(ctx),
        event_id,
        balance: balance::zero<T>(),
    };

    event::emit(EventCreated {
        event_id,
        vault_id: object::id(&vault),
        host,
        title,
        deposit_amount,
        seat_count,
        settlement_mode,
    });

    transfer::share_object(event);
    transfer::share_object(vault);
}

public fun reserve<T>(
    event: &mut Event,
    vault: &mut EventVault<T>,
    deposit: Coin<T>,
    ctx: &mut TxContext,
): Reservation {
    assert!(event.status == STATUS_OPEN, E_EVENT_CLOSED);
    assert!(event.reserved_count < event.seat_count, E_EVENT_FULL);
    assert!(vault.event_id == object::id(event), E_EVENT_CLOSED);
    assert!(deposit.value() == event.deposit_amount, E_DEPOSIT_MISMATCH);

    let attendee = tx_context::sender(ctx);
    assert!(!event.registered_attendees.contains(&attendee), E_DUPLICATE_RESERVATION);
    let reservation = Reservation {
        id: object::new(ctx),
        event_id: object::id(event),
        attendee,
        deposit_amount: event.deposit_amount,
        status: RESERVATION_RESERVED,
        created_at_ms: 0,
        checked_in_at_ms: 0,
    };
    let reservation_id = object::id(&reservation);

    event.registered_attendees.push_back(attendee);
    coin::put(&mut vault.balance, deposit);
    event.reserved_count = event.reserved_count + 1;
    if (event.reserved_count == event.seat_count) {
        event.status = STATUS_FULL;
    };

    event::emit(ReservationCreated {
        event_id: object::id(event),
        reservation_id,
        attendee,
        deposit_amount: event.deposit_amount,
    });

    reservation
}

public fun check_in<T>(
    event: &mut Event,
    vault: &mut EventVault<T>,
    reservation: &mut Reservation,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == event.host, E_NOT_HOST);
    assert!(vault.event_id == object::id(event), E_WRONG_EVENT);
    assert!(reservation.event_id == object::id(event), E_WRONG_EVENT);
    assert!(reservation.status == RESERVATION_RESERVED, E_INVALID_RESERVATION_STATUS);

    let refund_amount = reservation.deposit_amount;
    let refund = coin::take(&mut vault.balance, refund_amount, ctx);

    reservation.status = RESERVATION_CHECKED_IN_REFUNDED;
    reservation.checked_in_at_ms = 0;
    event.checked_in_count = event.checked_in_count + 1;
    event.checked_in_attendees.push_back(reservation.attendee);

    event::emit(CheckedInAndRefunded {
        event_id: object::id(event),
        reservation_id: object::id(reservation),
        attendee: reservation.attendee,
        refund_amount,
    });

    transfer::public_transfer(refund, reservation.attendee);
}

public fun cancel_reservation<T>(
    event: &mut Event,
    vault: &mut EventVault<T>,
    reservation: &mut Reservation,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == reservation.attendee, E_NOT_HOST);
    assert!(vault.event_id == object::id(event), E_WRONG_EVENT);
    assert!(reservation.event_id == object::id(event), E_WRONG_EVENT);
    assert!(reservation.status == RESERVATION_RESERVED, E_INVALID_RESERVATION_STATUS);
    let (registered, attendee_index) = event.registered_attendees.index_of(&reservation.attendee);
    assert!(registered, E_INVALID_RESERVATION_STATUS);
    event.registered_attendees.remove(attendee_index);

    let refund_amount = reservation.deposit_amount;
    let refund = coin::take(&mut vault.balance, refund_amount, ctx);

    reservation.status = RESERVATION_CANCELLED;
    event.reserved_count = event.reserved_count - 1;
    if (event.status == STATUS_FULL) {
        event.status = STATUS_OPEN;
    };

    event::emit(ReservationCancelled {
        event_id: object::id(event),
        reservation_id: object::id(reservation),
        attendee: reservation.attendee,
        refund_amount,
    });

    transfer::public_transfer(refund, reservation.attendee);
}

public fun settle_event<T>(
    event: &mut Event,
    vault: &mut EventVault<T>,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == event.host, E_NOT_HOST);
    assert!(vault.event_id == object::id(event), E_WRONG_EVENT);
    assert!(event.status != STATUS_SETTLED, E_EVENT_CLOSED);

    let remaining = vault.balance.value();
    let mut distributed_amount = 0;
    let mut forfeited_amount = remaining;
    let no_show = event.reserved_count - event.checked_in_count;

    if (remaining > 0) {
        if (event.settlement_mode == SETTLEMENT_MODE_PARTY && event.checked_in_count > 0) {
            let share = remaining / event.checked_in_count;
            let mut index = 0;
            while (index < event.checked_in_count) {
                let recipient = *event.checked_in_attendees.borrow(index);
                let reward = coin::take(&mut vault.balance, share, ctx);
                transfer::public_transfer(reward, recipient);
                distributed_amount = distributed_amount + share;
                index = index + 1;
            };
            let remainder = vault.balance.value();
            if (remainder > 0) {
                let payout = coin::take(&mut vault.balance, remainder, ctx);
                transfer::public_transfer(payout, event.host);
            };
            forfeited_amount = 0;
        } else {
            let payout = coin::take(&mut vault.balance, remaining, ctx);
            transfer::public_transfer(payout, event.host);
        };
    };

    event.status = STATUS_SETTLED;

    let receipt = SettlementReceipt {
        id: object::new(ctx),
        event_id: object::id(event),
        total_reserved: event.reserved_count,
        total_checked_in: event.checked_in_count,
        total_no_show: no_show,
        checked_in_refunded_amount: event.checked_in_count * event.deposit_amount,
        forfeited_amount,
        distributed_amount,
        settled_at_ms: 0,
    };
    let receipt_id = object::id(&receipt);

    event::emit(EventSettled {
        event_id: object::id(event),
        receipt_id,
        total_reserved: event.reserved_count,
        total_checked_in: event.checked_in_count,
        total_no_show: no_show,
        forfeited_amount,
        distributed_amount,
    });

    transfer::public_transfer(receipt, event.host);
}

#[test_only]
public fun destroy_settlement_receipt_for_testing(receipt: SettlementReceipt) {
    let SettlementReceipt {
        id,
        event_id: _,
        total_reserved: _,
        total_checked_in: _,
        total_no_show: _,
        checked_in_refunded_amount: _,
        forfeited_amount: _,
        distributed_amount: _,
        settled_at_ms: _,
    } = receipt;
    id.delete();
}
