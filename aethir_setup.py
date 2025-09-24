#!/usr/bin/env python3
import subprocess
import os

def run_cmd(cmd, check=True):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if check and result.returncode != 0:
        raise Exception(f"Command failed: {cmd}")
    return result

def main():
    container_name = input("Enter container name (e.g., aethir-node): ").strip()
    
    # Path to the Aethir tar file (adjust as needed)
    tar_file = "/root/AethirCheckerCLI-linux-1.0.3.2.tar.gz"
    if not os.path.exists(tar_file):
        print(f"❌ File not found: {tar_file}")
        print("Please ensure the Aethir tar file is in the correct location")
        return

    # Step 1: Build the Docker image first
    print("Building Docker image...")
    run_cmd("docker build -t aethir-checker .")

    # Step 2: Run the container with proper systemd support
    docker_run_cmd = f"""docker run --privileged --cgroupns=host \
        --name {container_name} \
        -v /sys/fs/cgroup:/sys/fs/cgroup \
        -d aethir-checker"""
    run_cmd(docker_run_cmd)

    # Step 3: Copy the tar.gz file into the container
    docker_cp_cmd = f"docker cp {tar_file} {container_name}:/root/"
    run_cmd(docker_cp_cmd)

    # Step 4: Extract and install inside the container
    commands_inside = (
        "cd /root && "
        "tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && "
        "cd AethirCheckerCLI-linux && "
        "./install.sh"
    )
    docker_exec_cmd = f"docker exec {container_name} bash -c '{commands_inside}'"
    run_cmd(docker_exec_cmd)

    # Step 5: Drop into interactive shell inside ~/AethirCheckerCLI-linux
    print(f"\n✅ Setup complete. Entering container: {container_name}")
    os.system(f"docker exec -it {container_name} bash -c 'cd /root/AethirCheckerCLI-linux && bash'")

if __name__ == "__main__":
    main()
