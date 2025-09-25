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
#
# /root/aethir_wallet_expect_fixed.exp <path-to-AethirCLI> <out-json>
# Example:
#   /root/aethir_wallet_expect_fixed.exp /root/AethirCheckerCLI-linux/AethirCheckerCLI /root/wallet.json

if { $argc < 2 } {
    puts "Usage: $argv0 <path-to-AethirCLI> <out-json>"
    exit 1
}
set cli_path [lindex $argv 0]
set out_json  [lindex $argv 1]

# debug log
log_file -noappend /tmp/aethir_expect.log

# adjust if wallet creation is slow
set timeout 180

# helper: send string slowly (ms delay between chars)
proc send_slow {s} {
    foreach ch [split $s ""] {
        send -- $ch
        after 30
    }
}

spawn -noecho $cli_path

# Accept TOS if prompted; tolerate multiple variants
expect {
    -re {Y/N:|Press y to continue|Please accept the Terms of service} {
        send "y\r"
        exp_continue
    }
    timeout {}
    eof {}
}

# Wait for the Aethir> prompt and ensure CLI is ready
expect {
    -re {Aethir>\s*$} {
        # Wait 2 seconds after prompt appears to ensure CLI is ready
        after 2000
        # Send command slowly
        send_slow "aethir wallet create\r"
    }
    timeout {
        puts "ERROR: timeout waiting for Aethir> prompt. See /tmp/aethir_expect.log"
        exit 2
    }
    eof {
        puts "ERROR: CLI exited early. See /tmp/aethir_expect.log"
        exit 3
    }
}

# Now wait for keys to be printed. Try multiple patterns and multi-line fallback.
set priv ""
set pub ""
set timeout 180

expect {
    -re {(?i)current\s+private\s+key[:\s]*([A-Za-z0-9\-\_]+)} {
        set priv $expect_out(1,string); exp_continue
    }
    -re {(?i)private\s+key[:\s]*([A-Za-z0-9\-\_]+)} {
        if {$priv == ""} { set priv $expect_out(1,string) }; exp_continue
    }
    -re {(?i)current\s+public\s+key[:\s]*([A-Za-z0-9\-\_]+)} {
        set pub $expect_out(1,string); exp_continue
    }
    -re {(?i)public\s+key[:\s]*([A-Za-z0-9\-\_]+)} {
        if {$pub == ""} { set pub $expect_out(1,string) }; exp_continue
    }
    eof {}
    timeout {}
}

# If not found, parse the logged session for label + newline + key patterns
if { $priv == "" || $pub == "" } {
    if {[catch {set fh [open "/tmp/aethir_expect.log" "r"]} err]} {
        puts "ERROR: cannot open /tmp/aethir_expect.log : $err"
    } else {
        set logged [read $fh]
        close $fh
        if {$priv == ""} {
            if {[regexp -nocase {current\s+private\s+key:\s*\r?\n\s*([A-Za-z0-9\-\_]+)} $logged -> k]} { set priv $k }
            if {$priv == "" && [regexp -nocase {private\s+key:\s*\r?\n\s*([A-Za-z0-9\-\_]+)} $logged -> k]} { set priv $k }
        }
        if {$pub == ""} {
            if {[regexp -nocase {current\s+public\s+key:\s*\r?\n\s*([A-Za-z0-9\-\_]+)} $logged -> k]} { set pub $k }
            if {$pub == "" && [regexp -nocase {public\s+key:\s*\r?\n\s*([A-Za-z0-9\-\_]+)} $logged -> k]} { set pub $k }
        }
    }
}

if { $priv == "" || $pub == "" } {
    puts "ERROR: Could not find both keys. priv='$priv' pub='$pub'. Inspect /tmp/aethir_expect.log"
    exit 4
}

# write json
set fh [open $out_json "w"]
puts $fh "{"
puts $fh "  \"private_key\": \"$priv\","
puts $fh "  \"public_key\": \"$pub\""
puts $fh "}"
close $fh

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
