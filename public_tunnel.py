import os
import sys
import time
import socket
import subprocess
import re
import webbrowser

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def ensure_servers_running():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, 'frontend')

    # 1. Backend (FastAPI on port 8000)
    if not is_port_in_use(8000):
        print("[*] Starting FastAPI Backend on port 8000...")
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=root_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        for _ in range(30):
            if is_port_in_use(8000):
                print("[+] Backend is ready on port 8000!")
                break
            time.sleep(0.5)
    else:
        print("[+] Backend is already running on port 8000.")

    # 2. Frontend (Next.js on port 3000)
    if not is_port_in_use(3000):
        print("[*] Starting Next.js Frontend on port 3000...")
        next_bin = os.path.join(frontend_dir, 'node_modules', 'next', 'dist', 'bin', 'next')
        subprocess.Popen(
            ["node", next_bin, "start", "-p", "3000"],
            cwd=frontend_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        for _ in range(40):
            if is_port_in_use(3000):
                print("[+] Frontend is ready on port 3000!")
                break
            time.sleep(0.5)
    else:
        print("[+] Frontend is already running on port 3000.")

def start_cloudflare_tunnel():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    cf_exe = os.path.join(root_dir, 'bin', 'cloudflared.exe')

    if not os.path.exists(cf_exe):
        print(f"[!] cloudflared.exe not found at {cf_exe}.")
        print("[*] Please run start.bat to use local access.")
        return

    print("\n[*] Initializing secure Cloudflare Tunnel to port 3000...")
    cmd = [cf_exe, "tunnel", "--url", "http://localhost:3000"]
    
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace'
    )

    public_url = None
    start_time = time.time()

    # Read output to locate the generated trycloudflare URL
    for line in proc.stderr:
        print(f"  [tunnel] {line.strip()}", flush=True)
        match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
        if match:
            public_url = match.group(0)
            break
        if time.time() - start_time > 30:
            break

    local_ip = get_local_ip()

    if public_url:
        with open(os.path.join(root_dir, 'public_url.txt'), 'w', encoding='utf-8') as f:
            f.write(public_url + "\n")

    print("\n" + "=" * 68, flush=True)
    print("       *** ENERGY TWINS AI -- ONLINE & PUBLIC ACCESS READY ***", flush=True)
    print("=" * 68, flush=True)
    print(f"  [>] Local Access:       http://localhost:3000", flush=True)
    print(f"  [>] Wi-Fi Network:      http://{local_ip}:3000", flush=True)
    if public_url:
        print(f"  [>] PUBLIC HTTPS URL:   {public_url}", flush=True)
        print("     (Accessible worldwide from any smartphone, laptop, or tablet!)", flush=True)
        print(f"  [>] Saved to file:      public_url.txt", flush=True)
    else:
        print("  [!] Tunnel URL not captured automatically. Check logs above.", flush=True)
    print("=" * 68, flush=True)
    print("  Press Ctrl + C in this terminal anytime to stop the tunnel.", flush=True)
    print("=" * 68 + "\n", flush=True)

    if public_url:
        try:
            webbrowser.open(public_url)
        except Exception:
            pass

    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\n[*] Stopping Cloudflare Tunnel...")
        proc.terminate()
        print("[+] Tunnel closed safely.")

if __name__ == '__main__':
    ensure_servers_running()
    start_cloudflare_tunnel()
