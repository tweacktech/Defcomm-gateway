<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    //


    public function index(Request $request){

    $activityLog=ActivityLog::query();
    if($request->query('user')){
        $ $activityLog->where('user',$request->user);
    }

     $activityLog->get();

     return inertia();

    }
}
