<?php

namespace App\Models;

/**
 * Legacy alias — prefer App\Models\File.
 * Kept so older services that import Files still resolve.
 */
class Files extends File
{
}
