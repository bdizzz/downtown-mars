using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using Godot;

namespace DowntownMars;

/// <summary>
/// The link to the simulation (npm run bridge: src/bridge/main.ts). Messages are JSON, one per line,
/// in the web game's worker protocol (src/worker/protocol.ts) plus the bridge's own "scene". A
/// background thread reads and parses them; the main thread takes them with <see cref="Poll"/>.
/// Reconnects by itself if the bridge isn't running yet or restarts.
/// </summary>
public class Bridge : IDisposable
{
    readonly string _host;
    readonly int _port;
    readonly ConcurrentQueue<JsonDocument> _inbox = new();
    readonly Thread _thread;
    volatile bool _stopping;
    TcpClient? _client;
    NetworkStream? _stream;
    readonly object _sendLock = new();

    volatile bool _greeted;
    /// <summary>Connected to the bridge itself: it said hello (something else could be listening on the port).</summary>
    public bool Connected => _client?.Connected == true && _greeted;
    /// <summary>Connected to something on the port that hasn't said hello (yet): likely not the bridge.</summary>
    public bool Silent => _client?.Connected == true && !_greeted;

    public Bridge(string host = "127.0.0.1", int port = 17878)
    {
        _host = host;
        _port = port;
        _thread = new Thread(Run) { IsBackground = true, Name = "bridge" };
        _thread.Start();
    }

    /// <summary>The next message, if one has come in.</summary>
    public bool Poll(out JsonDocument message) => _inbox.TryDequeue(out message!);

    /// <summary>The latest message of each kind is all that matters for snapshots: drop the older ones.</summary>
    public int Waiting => _inbox.Count;

    public void Send(object message)
    {
        var line = JsonSerializer.Serialize(message) + "\n";
        var bytes = Encoding.UTF8.GetBytes(line);
        lock (_sendLock)
        {
            try { _stream?.Write(bytes); }
            catch (Exception e) { GD.PushWarning($"Bridge send failed: {e.Message}"); }
        }
    }

    void Run()
    {
        while (!_stopping)
        {
            try
            {
                _client = new TcpClient { NoDelay = true, ReceiveBufferSize = 1 << 20 };
                _client.Connect(_host, _port);
                _stream = _client.GetStream();
                GD.Print($"Bridge: connected to {_host}:{_port}");
                using var reader = new StreamReader(_stream, Encoding.UTF8, false, 1 << 20);
                string? line;
                while (!_stopping && (line = reader.ReadLine()) != null)
                {
                    if (line.Length == 0) continue;
                    var doc = JsonDocument.Parse(line);
                    if (doc.RootElement.TryGetProperty("type", out var t) && t.GetString() == "hello")
                    {
                        _greeted = true;
                        doc.Dispose();
                        continue;
                    }
                    _inbox.Enqueue(doc);
                }
            }
            catch (Exception)
            {
                // Not running yet, gone, or closing down: try again shortly (or stop).
            }
            _greeted = false;
            _stream = null;
            _client?.Dispose();
            _client = null;
            if (!_stopping) Thread.Sleep(1000);
        }
    }

    public void Dispose()
    {
        _stopping = true;
        _client?.Dispose();
    }
}
