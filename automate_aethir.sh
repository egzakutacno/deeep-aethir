#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."

INSTALL_PATH="/root/AethirCheckerCLI-linux/install.sh"
if [ -f "$INSTALL_PATH" ]; then
    bash "$INSTALL_PATH"
else
    echo "❗ install.sh not found at $INSTALL_PATH"
    exit 1
fi

echo "[2/3] Running Python wallet automation..."

python3 <<'EOF'
import pexpect, sys, re, json

print("🚀 Starting Aethir CLI with pexpect...")
child = pexpect.spawn("/root/AethirCheckerCLI-linux/AethirCheckerCLI", encoding="utf-8", timeout=60)
child.logfile = sys.stdout

wallet = {"private_key": None, "public_key": None}

try:
    print("📋 Waiting for Terms of Service prompt...")
    child.expect("Y/N:")
    child.sendline("y")
    print("✅ Accepted Terms of Service")

    child.expect("Aethir>")
    child.sendline("aethir wallet create")
    print("🔑 Creating wallet...")

    child.expect("Aethir>")
    child.sendline("aethir wallet export")
    print("📤 Exporting wallet keys...")

    # Capture output until next prompt
    child.expect("Aethir>")
    output = child.before

    # Extract keys
    priv_match = re.search(r"Current private key:\s*([\s\S]+?)\n", output)
    pub_match = re.search(r"Current public key:\s*([0-9a-f]+)", output)

    if priv_match:
        wallet["private_key"] = priv_match.group(1).strip()
    if pub_match:
        wallet["public_key"] = pub_match.group(1).strip()

    # Save keys
    with open("/root/wallet.json", "w") as f:
        json.dump(wallet, f, indent=2)

    print("✅ Wallet keys saved to /root/wallet.json")

except pexpect.TIMEOUT:
    print("❌ Timeout while waiting for CLI output")
    sys.exit(1)
except pexpect.EOF:
    print("❌ Process ended unexpectedly")
    sys.exit(1)
EOF

echo "[3/3] Wallet automation complete!"

# Check if wallet.json was created
if [ -f "/root/wallet.json" ]; then
    echo "✅ Wallet keys successfully saved to /root/wallet.json"
    echo "📄 Wallet contents:"
    cat /root/wallet.json
else
    echo "❌ Wallet.json not found - automation may have failed"
fi