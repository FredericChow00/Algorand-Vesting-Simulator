import sys
sys.path.insert(0,'.')

from algobpy.parse import parse_params
from pyteal import *

def vesting_approval():

    tmpl_period = Int(13) # 60 seconds / 4.5 sec = ~13 rounds per period 
    tmpl_dur = Int(320) # since max vesting period = 24 mins = 1440secs, 1440 / 4.5 = 320 rounds long
    cliff_rounds = Int(160)
    reserves_allocated = Int(30000000)
    investors_allocated = Int(20000000)
    team_allocated = Int(15000000)
    advisors_allocated = Int(10000000)

    basic_checks = And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
    )

    team_address = Txn.accounts[1]
    advisors_address = Txn.accounts[2]
    private_inv_address = Txn.accounts[3]
    asset_id = Txn.assets[0]
    handle_creation = Seq([
        App.globalPut(Bytes("AssetID"), asset_id),
        App.globalPut(Bytes("Team Address"), team_address), 
        App.globalPut(Bytes("Advisor Address"), advisors_address), 
        App.globalPut(Bytes("PrivateInv Address"), private_inv_address), 
        App.globalPut(Bytes("Initial Round"), Global.round()), # keeps track of the round where the contract was first created
        App.globalPut(Bytes("Final Round"), Global.round() + tmpl_dur), # keeps track of the round where the vesting period ends 

        App.globalPut(Bytes("Reserves Allocated Tokens"), reserves_allocated), # keeps track of tokens allocated and max withdrawal of company reserves 
        App.globalPut(Bytes("Amount Reserves Withdrawn"), Int(0)), # start when when tokens get first unlocked

        App.globalPut(Bytes("Advisors Allocated Tokens"), advisors_allocated), # constant
        App.globalPut(Bytes("Amount Advisors Withdrawn"), Int(0)), # start when when tokens get first unlocked

        App.globalPut(Bytes("Investors Allocated Tokens"), investors_allocated), # constant
        App.globalPut(Bytes("Amount Investors Withdrawn"), Int(0)), # start when when tokens get first unlocked

        App.globalPut(Bytes("Team Allocated Tokens"), team_allocated), # constant
        App.globalPut(Bytes("Amount Team Withdrawn"), Int(0)), # start when when tokens get first unlocked
        Return(Int(1))
    ])

    amount_withdrawn = Btoi(Txn.application_args[1])
    max_withdrawal = Btoi(Txn.application_args[2])

    def get_amount_withdrawn(stakeholder):
        return App.globalGet(Bytes(f"Amount {stakeholder} Withdrawn"))

    def set_amount_withdrawn(stakeholder, amount_withdrawn):
        return App.globalPut(Bytes(f"Amount {stakeholder} Withdrawn"), 
                get_amount_withdrawn(stakeholder) + amount_withdrawn)

    def get_max_allocation(stakeholder):
        return App.globalGet(Bytes(f"{stakeholder} Allocated Tokens"))
        
    def transfer_tokens(stakeholder):
        return Seq([
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields({
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.asset_receiver: Txn.sender(),
                TxnField.asset_amount: amount_withdrawn,
                TxnField.xfer_asset: asset_id
            }),
            InnerTxnBuilder.Submit(),
            set_amount_withdrawn(stakeholder, amount_withdrawn),
            Return(Int(1))
        ])

    periods_passed = Div((Txn.first_valid() - App.globalGet(Bytes("Initial Round"))), tmpl_period)

    def get_current_max_withdrawal(stakeholder):
        return If(Global.round() >= (App.globalGet(Bytes("Final Round"))), # if past vesting period, just take total allocated - what has been withdrawn
            get_max_allocation(stakeholder) - get_amount_withdrawn(stakeholder),
            If(Global.round() >= (App.globalGet(Bytes("Initial Round")) + cliff_rounds), # else if past cliffing period only, then calcualte based on fraction
                Div(Mul(get_max_allocation(stakeholder), periods_passed), Int(24)) - get_amount_withdrawn(stakeholder),
                Int(0) # else max withdrawal is 0 if havent't passed cliffing period
            )
        )

    max_withdrawal = Btoi(Txn.application_args[2])
    def stakeholder_withdrawal(stakeholder):
        return Seq(
            Assert(max_withdrawal == get_current_max_withdrawal(stakeholder)), # ensure max withdrawal is accurate
            Assert(amount_withdrawn <= get_current_max_withdrawal(stakeholder)), # ensure that amount withdrawn is within limits of max withdrawal
            transfer_tokens(stakeholder),
            Return(Int(1))
        )

    # no need to update max withdrawal for company reserves because the max token withdrawal is same as total allocated tokens
    reserves_withdrawal = Seq(
        Assert(max_withdrawal == App.globalGet(Bytes("Reserves Allocated Tokens")) - App.globalGet(Bytes("Amount Reserves Withdrawn"))), # ensure max withdrawal is accurate
        Assert(amount_withdrawn <= App.globalGet(Bytes("Reserves Allocated Tokens")) - App.globalGet(Bytes("Amount Reserves Withdrawn"))), # ensure that amount withdrawn is within limits of max withdrawal
        transfer_tokens("Reserves"),
        Return(Int(1))
    )

    withdraw_tokens = Seq(
        Cond(
            [Global.creator_address() == Txn.sender(), reserves_withdrawal],
            [Txn.sender() == App.globalGet(Bytes("Advisor Address")), stakeholder_withdrawal("Advisors")],
            [Txn.sender() == App.globalGet(Bytes("Team Address")), stakeholder_withdrawal("Team")],
            [Txn.sender() == App.globalGet(Bytes("PrivateInv Address")), stakeholder_withdrawal("Investors")],
        )
    )

    assetBalance = AssetHolding.balance(Global.current_application_address(), asset_id)
    asset_optin = Seq([
        assetBalance,
        Assert(assetBalance.hasValue() == Int(0)),
        Assert(asset_id == App.globalGet(Bytes("AssetID"))),
        Assert(Txn.sender() == Global.creator_address()),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.xfer_asset: asset_id
        }),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    ])

    handle_noop = Seq(
        Assert(Global.group_size() == Int(1)), 
        Cond(
            [Txn.application_args[0] == Bytes("Withdraw"), withdraw_tokens],
            [Txn.application_args[0] == Bytes("OptIn"), asset_optin], # opt app into asset before transferring tokens to it
        )
    )

    handle_optin = Return(Int(0))
    handle_closeout = Return(Int(1))
    handle_updateapp = Return(Int(0))
    handle_deleteapp = Return(Int(0))

    program = Seq([
        Assert(basic_checks == Int(1)),
        Cond(
            [Txn.application_id() == Int(0), handle_creation],
            [Txn.on_completion() == OnComplete.OptIn, handle_optin],
            [Txn.on_completion() == OnComplete.CloseOut, handle_closeout],
            [Txn.on_completion() == OnComplete.UpdateApplication, handle_updateapp],
            [Txn.on_completion() == OnComplete.DeleteApplication, handle_deleteapp],
            [Txn.on_completion() == OnComplete.NoOp, handle_noop]
        )
    ])

    return program

if __name__ == "__main__":
    params = {}

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(vesting_approval(), mode=Mode.Application, version=6))