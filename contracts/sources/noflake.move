module noflake::noflake;

use std::string::String;
use sui::object::UID;

public struct Event has key, store {
    id: UID,
    title: String,
}
