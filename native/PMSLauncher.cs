using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
        string launcher = Path.Combine(dir, "launcher.py");

        if (!File.Exists(launcher))
        {
            Console.Error.WriteLine("launcher.py not found next to PMS.exe");
            Console.Error.WriteLine("Keep PMS.exe in the same folder as the PMS project files.");
            Console.WriteLine("Press Enter to exit...");
            Console.ReadLine();
            return 1;
        }

        string[][] attempts = new string[][]
        {
            new[] { "py", "-3 \"" + launcher + "\"" },
            new[] { "python", "\"" + launcher + "\"" },
            new[] { "python3", "\"" + launcher + "\"" },
        };

        foreach (string[] attempt in attempts)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = attempt[0],
                    Arguments = attempt[1],
                    WorkingDirectory = dir,
                    UseShellExecute = false,
                };

                using (Process process = Process.Start(psi))
                {
                    if (process == null)
                    {
                        continue;
                    }

                    process.WaitForExit();
                    return process.ExitCode;
                }
            }
            catch
            {
                // try next launcher
            }
        }

        Console.Error.WriteLine("Python was not found.");
        Console.Error.WriteLine("Install Python 3 from https://www.python.org/downloads/");
        Console.Error.WriteLine("Then run: pip install -r requirements.txt");
        Console.WriteLine("Press Enter to exit...");
        Console.ReadLine();
        return 1;
    }
}
