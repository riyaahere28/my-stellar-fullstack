#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Vec, I128,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    NotSigner = 3,
    AlreadySigned = 4,
    AlreadyExecuted = 5,
    InsufficientBalance = 6,
    NotAuthorized = 7,
}

#[contracttype]
#[derive(Clone)]
pub struct Wallet {
    pub signers: Vec<Address>,
    pub threshold: u32,
    pub balance: i128,
    pub token: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Transaction {
    pub target: Address,
    pub amount: i128,
    pub signed: Vec<Address>,
    pub signed_count: u32,
    pub executed: bool,
}

#[contracttype]
pub enum DataKey {
    Wallet(String),
    WalletIds,
    Tx(String, u32),
    TxCount(String),
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Create a new multisig wallet with specified signers and threshold.
    /// PERMISSIONLESS: Anyone can create a wallet.
    pub fn create_wallet(
        env: Env,
        wallet_id: String,
        signers: Vec<Address>,
        threshold: u32,
        token: Address,
    ) -> Result<(), Error> {
        require(
            threshold > 0 && threshold <= signers.len() as u32,
            "invalid threshold",
        );
        let key = DataKey::Wallet(wallet_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyExists);
        }
        env.storage().persistent().set(
            &key,
            &Wallet {
                signers,
                threshold,
                balance: 0,
                token,
            },
        );
        let mut ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::WalletIds)
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(wallet_id);
        env.storage().persistent().set(&DataKey::WalletIds, &ids);
        Ok(())
    }

    /// Get wallet details.
    pub fn get_wallet(env: Env, wallet_id: String) -> Result<Wallet, Error> {
        let key = DataKey::Wallet(wallet_id);
        env.storage().persistent().get(&key).ok_or(Error::NotFound)
    }

    /// Get all wallet IDs.
    pub fn get_wallets(env: Env) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::WalletIds)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Deposit tokens into the wallet.
    /// PERMISSIONLESS: Anyone can deposit to any wallet.
    pub fn deposit(env: Env, wallet_id: String, from: Address, amount: i128) -> Result<(), Error> {
        require(amount > 0, "amount must be positive");
        from.require_auth();

        let key = DataKey::Wallet(wallet_id.clone());
        let mut wallet: Wallet = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;

        // Transfer tokens to this contract
        token::Client::new(&env, &wallet.token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        wallet.balance += amount;
        env.storage().persistent().set(&key, &wallet);
        Ok(())
    }

    /// Propose a transfer from the wallet.
    /// PERMISSIONLESS: Anyone can propose a transaction.
    pub fn propose(
        env: Env,
        wallet_id: String,
        target: Address,
        amount: i128,
    ) -> Result<u32, Error> {
        require(amount > 0, "amount must be positive");
        let key = DataKey::Wallet(wallet_id.clone());
        let wallet: Wallet = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;

        require(wallet.balance >= amount, "insufficient balance");

        let tx_count_key = DataKey::TxCount(wallet_id.clone());
        let tx_count: u32 = env.storage().persistent().get(&tx_count_key).unwrap_or(0);
        let tx_key = DataKey::Tx(wallet_id.clone(), tx_count);
        let tx = Transaction {
            target,
            amount,
            signed: Vec::new(&env),
            signed_count: 0,
            executed: false,
        };
        env.storage().persistent().set(&tx_key, &tx);
        env.storage()
            .persistent()
            .set(&tx_count_key, &(tx_count + 1));
        Ok(tx_count)
    }

    /// Get a transaction by index.
    pub fn get_transaction(
        env: Env,
        wallet_id: String,
        tx_index: u32,
    ) -> Result<Transaction, Error> {
        let key = DataKey::Wallet(wallet_id.clone());
        let _: Wallet = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;
        let tx_key = DataKey::Tx(wallet_id, tx_index);
        env.storage()
            .persistent()
            .get(&tx_key)
            .ok_or(Error::NotFound)
    }

    /// Get transaction count for a wallet.
    pub fn get_transaction_count(env: Env, wallet_id: String) -> Result<u32, Error> {
        let key = DataKey::Wallet(wallet_id.clone());
        let _: Wallet = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::TxCount(wallet_id))
            .unwrap_or(0))
    }

    /// Sign a transaction.
    /// Only wallet signers can sign.
    pub fn sign(env: Env, wallet_id: String, tx_index: u32, signer: Address) -> Result<(), Error> {
        signer.require_auth();
        let wallet_key = DataKey::Wallet(wallet_id.clone());
        let mut wallet: Wallet = env
            .storage()
            .persistent()
            .get(&wallet_key)
            .ok_or(Error::NotFound)?;

        if !wallet.signers.contains(&signer) {
            return Err(Error::NotSigner);
        }

        let tx_key = DataKey::Tx(wallet_id.clone(), tx_index);
        let mut tx: Transaction = env
            .storage()
            .persistent()
            .get(&tx_key)
            .ok_or(Error::NotFound)?;

        if tx.executed {
            return Err(Error::AlreadyExecuted);
        }
        if tx.signed.contains(&signer) {
            panic!("already signed");
        }

        tx.signed.push_back(signer.clone());
        tx.signed_count += 1;
        env.storage().persistent().set(&tx_key, &tx);

        // Execute if threshold reached
        if tx.signed_count >= wallet.threshold {
            tx.executed = true;
            env.storage().persistent().set(&tx_key, &tx);

            // Execute the actual transfer
            token::Client::new(&env, &wallet.token).transfer(
                &env.current_contract_address(),
                &tx.target,
                &tx.amount,
            );

            // Update wallet balance
            wallet.balance -= tx.amount;
            env.storage().persistent().set(&wallet_key, &wallet);
        }

        Ok(())
    }
}

fn require(condition: bool, _msg: &str) {
    if !condition {
        panic!("requirement failed");
    }
}

mod test;
