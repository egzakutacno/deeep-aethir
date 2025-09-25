#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."
if [ -f /root/AethirCheckerCLI-linux/install.sh ]; then
    bash /root/AethirCheckerCLI-linux/install.sh || echo "install.sh failed, continuing..."
else
    echo "install.sh not found, skipping..."
fi

echo "[2/3] Running wallet automation..."

# Check if wallet already exists
if [ -f "/root/wallet.json" ]; then
    echo "wallet.json already exists. Skipping wallet creation."
    exit 0
fi

# Create the expect script
cat > /root/aethir_wallet_expect.exp << 'EXPECT_EOF'
#!/usr/bin/expect -f
# Usage: ./aethir_wallet_expect.exp /root/AethirCheckerCLI-linux/AethirCheckerCLI /root/wallet.json
set cli_path [lindex $argv 0]
set out_json  [lindex $argv 1]

# adjust timeout as needed
set timeout 30

spawn -noecho $cli_path
# Accept the TOS if prompted (match Y/N with colon or whitespace)
expect {
  -re {Y/N:|Y/N: } { send "y\r"; exp_continue }
  -re {Please create a wallet|wallet create|wallet create\)} { send "aethir wallet create\r"; exp_continue }
  -re {Please create a wallet \(wallet create\)|Please create a wallet} { send "aethir wallet create\r"; exp_continue }
  timeout { puts "ERROR: timeout waiting for prompts"; exit 2 }
  eof {}
}

# Wait for the wallet creation to finish and capture lines
# We'll accumulate output, then parse for keys
set full_output ""
# Read until EOF
expect {
  -re "(.*)" {
    append full_output $expect_out(0,string)
    exp_continue
  }
  eof {}
}

# Remove ANSI ESC sequences (simple)
set cleaned [regsub -all {\x1b\[[0-9;]*[A-Za-z]} $full_output "" cleaned_out]
# Alternatively use more aggressive regex if needed
set cleaned $cleaned_out

# Try to extract private and public keys using regex groups
set priv ""
set pub ""
if {[regexp -nocase {Current private key:\s*(\S+)} $cleaned -> priv]} {
    # priv captured
} elseif {[regexp -nocase {Private Key:\s*(\S+)} $cleaned -> priv]} {
    # alternate phrasing
}

if {[regexp -nocase {Current public key:\s*(\S+)} $cleaned -> pub]} {
} elseif {[regexp -nocase {Public Key:\s*(\S+)} $cleaned -> pub]} {
}

if {$priv eq "" && $pub eq ""} {
    # Try looser patterns (any line with "private" or "public" near some token)
    if {[regexp -nocase {private.*?:\s*(\S+)} $cleaned -> priv]} {}
    if {[regexp -nocase {public.*?:\s*(\S+)} $cleaned -> pub]} {}
}

if {$priv eq "" || $pub eq ""} {
    puts "ERROR: could not find keys in CLI output. Dumping cleaned log to /tmp/aethir_cleaned.log"
    set f [open "/tmp/aethir_cleaned.log" "w"]
    puts $f $cleaned
    close $f
    exit 3
}

# Build JSON safely
set f [open $out_json "w"]
puts $f "{"
puts $f "  \"private_key\": \"$priv\","
puts $f "  \"public_key\": \"$pub\""
puts $f "}"
close $f

puts "Saved keys to $out_json"
exit 0
EXPECT_EOF

# Make the expect script executable
chmod +x /root/aethir_wallet_expect.exp

# Run the expect script
echo "Starting Aethir CLI with expect automation..."
/root/aethir_wallet_expect.exp /root/AethirCheckerCLI-linux/AethirCheckerCLI /root/wallet.json

echo "Wallet keys saved successfully!"

# Clean up
rm -f /root/aethir_wallet_expect.exp

echo "[3/3] Wallet automation completed!"
