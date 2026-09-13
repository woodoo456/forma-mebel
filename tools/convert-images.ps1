param([string]$ImagesDirectory = (Join-Path $PSScriptRoot '..\public\images'))

$codecDirectory = 'C:\Program Files\Unity Hub\resources\app.asar.unpacked\node_modules\canvas\build\Release'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class LocalWebPConverter
{
    [DllImport("kernel32", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetDllDirectory(string lpPathName);

    [DllImport("libwebp-7.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern UIntPtr WebPEncodeBGRA(IntPtr bgra, int width, int height, int stride, float qualityFactor, out IntPtr output);

    [DllImport("libwebp-7.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern void WebPFree(IntPtr pointer);

    public static void Convert(string source, string destination, string codecDirectory, int maxWidth, float quality)
    {
        if (!SetDllDirectory(codecDirectory)) throw new Exception("Could not register the local WebP codec directory.");
        using (var original = new Bitmap(source))
        {
            int width = Math.Min(original.Width, maxWidth);
            int height = (int)Math.Round(original.Height * (width / (double)original.Width));
            using (var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb))
            {
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    graphics.CompositingMode = CompositingMode.SourceCopy;
                    graphics.CompositingQuality = CompositingQuality.HighQuality;
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    graphics.DrawImage(original, 0, 0, width, height);
                }
                var rectangle = new Rectangle(0, 0, width, height);
                var bits = bitmap.LockBits(rectangle, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                IntPtr encoded = IntPtr.Zero;
                try
                {
                    UIntPtr length = WebPEncodeBGRA(bits.Scan0, width, height, bits.Stride, quality, out encoded);
                    ulong byteCount = length.ToUInt64();
                    if (byteCount == 0 || encoded == IntPtr.Zero) throw new Exception("WebP encoding failed: " + source);
                    byte[] bytes = new byte[checked((int)byteCount)];
                    Marshal.Copy(encoded, bytes, 0, bytes.Length);
                    File.WriteAllBytes(destination, bytes);
                }
                finally
                {
                    bitmap.UnlockBits(bits);
                    if (encoded != IntPtr.Zero) WebPFree(encoded);
                }
            }
        }
    }
}
'@

Get-ChildItem -LiteralPath $ImagesDirectory -Filter '*.png' | ForEach-Object {
    $destination = Join-Path $_.DirectoryName ($_.BaseName + '.webp')
    $maxWidth = if ($_.BaseName -eq 'hero-forma') { 1920 } else { 1600 }
    [LocalWebPConverter]::Convert($_.FullName, $destination, $codecDirectory, $maxWidth, 84)
    Get-Item -LiteralPath $destination | Select-Object Name, Length
}
