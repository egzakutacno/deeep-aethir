#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."

# Correct install.sh path
INSTALL_PATH="/root/AethirCheckerCLI-linux/install.sh"
if [ -f "$INSTALL_PATH" ]; then
    bash "$INSTALL_PATH"
else
    echo "❗ install.sh not found at $INSTALL_PATH"
    exit 1
fi

echo "[2/3] Running wallet automation..."

# Ensure expect is installed
if ! command -v expect &> /dev/null; then
    echo "Installing expect..."
    apt update && apt install -y expect
fi

# Automate Aethir CLI interaction
expect << 'EOF'
set timeout 60
log_file -noappend /tmp/aethir_interaction.log
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

send_user "DEBUG: CLI spawned, waiting for Y/N prompt...\n"

# Step 1 — Accept Terms of Service once
expect {
    -re "Y/N:" {
        send_user "DEBUG: Detected Y/N prompt, sending y...\n"
        sleep 1
        send "y\r"
    }
    timeout {
        send_user "DEBUG: Timeout waiting for Y/N prompt\n"
        exit 1
    }
}

send_user "DEBUG: Waiting for Aethir> prompt...\n"

# Step 2 — Wait for instructions then send wallet creation command
expect {
    -re "Please create a wallet" {
        send_user "DEBUG: Detected instructions, waiting 2 seconds...\n"
        sleep 2
        send_user "DEBUG: Sending command: aethir wallet create\n"
        send "aethir wallet create\r"
        send_user "DEBUG: Command sent successfully, waiting for wallet creation...\n"
        # Wait for wallet creation to complete
        sleep 10
        send_user "DEBUG: Wallet creation should be complete\n"
    }
    timeout {
        send_user "DEBUG: Timeout waiting for instructions\n"
        exit 1
    }
}

send_user "DEBUG: Waiting for wallet creation to complete...\n"

# Step 4 — Wait for wallet creation to finish (don't try to capture keys)
expect {
    -re "Aethir> " {
        send_user "✅ Wallet creation complete, CLI ready.\n"
        send_user "DEBUG: Now exporting wallet keys...\n"
        
        # Step 5 — Export wallet keys
        send "aethir wallet export\r"
        send_user "DEBUG: Export command sent\n"
        
        # Wait for export output and capture keys
        set priv_key ""
        set pub_key ""
        
        expect {
            -re "Private key: (.*)" {
                set priv_key $expect_out(1,string)
                send_user "DEBUG: Private key captured from export\n"
                exp_continue
            }
            -re "Public key: (.*)" {
                set pub_key $expect_out(1,string)
                send_user "DEBUG: Public key captured from export\n"
                exp_continue
            }
            -re "Aethir> " {
                send_user "✅ Export complete\n"
                
                # Save captured keys to file
                if {[string length $priv_key] > 0 && [string length $pub_key] > 0} {
                    set wallet_file [open "/root/wallet.json" w]
                    puts $wallet_file "{\n  \"private_key\": \"$priv_key\",\n  \"public_key\": \"$pub_key\"\n}"
                    close $wallet_file
                    send_user "✅ Wallet keys saved to /root/wallet.json\n"
                } else {
                    send_user "❌ Failed to capture wallet keys from export\n"
                }
                
                send "exit\r"
                expect eof
            }
            timeout {
                send_user "DEBUG: Timeout waiting for export\n"
                send "exit\r"
                expect eof
            }
        }
    }
    timeout {
        send_user "DEBUG: Timeout waiting for wallet creation completion\n"
        exit 1
    }
}

EOF

echo "[3/3] Wallet automation complete."

# Check if wallet.json was created by the expect script
if [ -f "/root/wallet.json" ]; then
    echo "✅ Wallet keys successfully saved to /root/wallet.json"
    echo "📄 Wallet contents:"
    cat /root/wallet.json
else
    echo "❌ Wallet.json not found - automation may have failed"
fi
