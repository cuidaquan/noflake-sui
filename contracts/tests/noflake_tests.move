#[test_only]
module noflake::noflake_tests;

use std::string;
use sui::coin;
use sui::test_scenario;
use sui::transfer;
use noflake::noflake;

public struct TEST_USDC has drop {}

#[test]
fun host_can_create_event_and_attendee_can_reserve() {
    let host = @0xA;
    let attendee = @0xB;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        2,
        noflake::settlement_mode_strict(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());

    let reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());
    transfer::public_transfer(reservation, attendee);

    assert!(noflake::reserved_count(&event) == 1);
    assert!(noflake::vault_balance(&vault) == 20);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);
    scenario.end();
}

#[test]
fun host_check_in_refunds_attendee_immediately() {
    let host = @0xA;
    let attendee = @0xB;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        2,
        noflake::settlement_mode_strict(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());

    let reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());
    transfer::public_transfer(reservation, attendee);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(host);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let mut reservation = scenario.take_from_address<noflake::Reservation>(attendee);

    noflake::check_in(&mut event, &mut vault, &mut reservation, scenario.ctx());

    assert!(noflake::checked_in_count(&event) == 1);
    assert!(noflake::reservation_status(&reservation) == noflake::reservation_status_checked_in_refunded());
    assert!(noflake::vault_balance(&vault) == 0);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);
    test_scenario::return_to_address(attendee, reservation);

    scenario.next_tx(attendee);
    let refund = scenario.take_from_sender<coin::Coin<TEST_USDC>>();
    assert!(coin::value(&refund) == 20);
    coin::burn_for_testing(refund);

    scenario.end();
}

#[test]
fun strict_settlement_transfers_no_show_deposit_to_host() {
    let host = @0xA;
    let attendee = @0xB;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        2,
        noflake::settlement_mode_strict(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());

    let reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());
    transfer::public_transfer(reservation, attendee);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(host);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();

    noflake::settle_event(&mut event, &mut vault, scenario.ctx());

    assert!(noflake::event_status(&event) == noflake::event_status_settled());
    assert!(noflake::vault_balance(&vault) == 0);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(host);
    let forfeited = scenario.take_from_sender<coin::Coin<TEST_USDC>>();
    assert!(coin::value(&forfeited) == 20);
    coin::burn_for_testing(forfeited);

    let receipt = scenario.take_from_sender<noflake::SettlementReceipt>();
    assert!(noflake::receipt_forfeited_amount(&receipt) == 20);
    noflake::destroy_settlement_receipt_for_testing(receipt);

    scenario.end();
}

#[test]
fun party_settlement_distributes_no_show_deposit_to_checked_in_attendee() {
    let host = @0xA;
    let attendee_one = @0xB;
    let attendee_two = @0xC;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        2,
        noflake::settlement_mode_party(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee_one);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());
    let reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());
    transfer::public_transfer(reservation, attendee_one);
    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(attendee_two);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());
    let reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());
    transfer::public_transfer(reservation, attendee_two);
    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(host);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let mut reservation = scenario.take_from_address<noflake::Reservation>(attendee_one);
    noflake::check_in(&mut event, &mut vault, &mut reservation, scenario.ctx());
    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);
    test_scenario::return_to_address(attendee_one, reservation);

    scenario.next_tx(attendee_one);
    let refund = scenario.take_from_sender<coin::Coin<TEST_USDC>>();
    assert!(coin::value(&refund) == 20);
    coin::burn_for_testing(refund);

    scenario.next_tx(host);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    noflake::settle_event(&mut event, &mut vault, scenario.ctx());
    assert!(noflake::vault_balance(&vault) == 0);
    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);

    scenario.next_tx(attendee_one);
    let reward = scenario.take_from_sender<coin::Coin<TEST_USDC>>();
    assert!(coin::value(&reward) == 20);
    coin::burn_for_testing(reward);

    scenario.next_tx(host);
    let receipt = scenario.take_from_sender<noflake::SettlementReceipt>();
    assert!(noflake::receipt_distributed_amount(&receipt) == 20);
    noflake::destroy_settlement_receipt_for_testing(receipt);

    scenario.end();
}

#[test]
fun attendee_can_cancel_reservation_and_get_refund() {
    let host = @0xA;
    let attendee = @0xB;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        2,
        noflake::settlement_mode_strict(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());
    let mut reservation = noflake::reserve(&mut event, &mut vault, deposit, scenario.ctx());

    noflake::cancel_reservation(&mut event, &mut vault, &mut reservation, scenario.ctx());

    assert!(noflake::reservation_status(&reservation) == noflake::reservation_status_cancelled());
    assert!(noflake::reserved_count(&event) == 0);
    assert!(noflake::vault_balance(&vault) == 0);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);
    transfer::public_transfer(reservation, attendee);

    scenario.next_tx(attendee);
    let refund = scenario.take_from_sender<coin::Coin<TEST_USDC>>();
    assert!(coin::value(&refund) == 20);
    coin::burn_for_testing(refund);

    scenario.end();
}

#[test, expected_failure]
fun event_rejects_reservation_after_capacity_is_full() {
    let host = @0xA;
    let attendee = @0xB;
    let mut scenario = test_scenario::begin(host);

    noflake::create_event<TEST_USDC>(
        string::utf8(b"Sui Builder Dinner"),
        1_000,
        2_000,
        20,
        1,
        noflake::settlement_mode_strict(),
        scenario.ctx(),
    );

    scenario.next_tx(attendee);
    let mut event = scenario.take_shared<noflake::Event>();
    let mut vault = scenario.take_shared<noflake::EventVault<TEST_USDC>>();
    let first_deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());
    let first_reservation = noflake::reserve(&mut event, &mut vault, first_deposit, scenario.ctx());
    transfer::public_transfer(first_reservation, attendee);

    let second_deposit = coin::mint_for_testing<TEST_USDC>(20, scenario.ctx());
    let second_reservation = noflake::reserve(&mut event, &mut vault, second_deposit, scenario.ctx());
    transfer::public_transfer(second_reservation, attendee);

    test_scenario::return_shared(event);
    test_scenario::return_shared(vault);
    scenario.end();
}
