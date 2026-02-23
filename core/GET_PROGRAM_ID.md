# How to Get the Test Program Public Key

## Option 1: Deploy the Anchor Program (Recommended)

After deploying the Anchor program, Anchor will output the program ID:

```bash
cd test-program
anchor build
anchor deploy --provider.cluster devnet
```

The deploy command will output something like:
```
Program Id: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

Copy that program ID and add it to your `.env` file:
```bash
AEGIS_TEST_PROGRAM_ID=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

## Option 2: Generate a Keypair and Use Its Public Key

If you want to use a specific keypair for the program:

```bash
solana-keygen new --outfile test-program-keypair.json
solana address -k test-program-keypair.json
```

Copy the address output and set it in `.env`:
```bash
AEGIS_TEST_PROGRAM_ID=<the-address-from-above>
```

Then update `test-program/Anchor.toml` to use that keypair:
```toml
[programs.devnet]
aegis_test = "<the-address-from-above>"
```

## Option 3: Use Anchor's Default Keypair

Anchor generates a keypair automatically. Check:
```bash
cd test-program
cat target/deploy/aegis_test-keypair.json
# or check the program ID in target/idl/aegis_test.json
```

## After Setting the Program ID

1. Add to `.env`:
```bash
echo "AEGIS_TEST_PROGRAM_ID=YOUR_PROGRAM_ID_HERE" >> .env
```

2. Rebuild:
```bash
npm run build
```

3. Initialize the counter (if deploying):
```bash
npm run init-test-program
```

4. Run agents:
```bash
npm run run
```
