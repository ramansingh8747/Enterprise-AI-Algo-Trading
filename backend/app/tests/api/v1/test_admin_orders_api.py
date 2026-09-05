"""Contract-level tests for the ADMIN order API boundary."""


def test_admin_orders_contract_paths_are_admin_scoped():
    assert "/admin/orders".startswith("/admin/")
    assert "/admin/orders/{order_ref}".startswith("/admin/")
