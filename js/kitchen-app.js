<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Kitchen Display | Indian Food Forest</title>
    
    <!-- Premium Google Fonts: Poppins -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- CSS Links -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/admin.css">

    <style>
        .hidden { display: none !important; }
        
        /* Premium KDS Dark Theme Customizations */
        body.kds-theme { background-color: #0F172A; color: #F8FAFC; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        
        .kds-header { background: #1E293B; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10; flex-shrink: 0; }
        .live-clock { font-size: 22px; font-weight: 600; font-family: monospace; background: #0F172A; padding: 8px 20px; border-radius: 8px; border: 1px solid #334155; color: #38BDF8; letter-spacing: 1px; }
        
        .kds-main { padding: 25px; flex: 1; overflow-y: auto; }
        
        .empty-state { margin-top: 15vh; color: #64748B; }
        .empty-state i { font-size: 70px; color: #334155; margin-bottom: 20px; }
        
        .kds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: start; }
        
        /* Order Cards Styling (Injected via JS) */
        .order-card { background: #1E293B; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); overflow: hidden; display: flex; flex-direction: column; border: 2px solid transparent; transition: all 0.3s ease; }
        .kds-card-header { background: #0F172A; padding: 15px 20px; border-bottom: 1px solid #334155; }
        .kds-card-meta { padding: 12px 20px; border-bottom: 1px dashed #334155; font-size: 13px; color: #94A3B8; font-weight: 500; background: #1E293B; }
        .kds-card-body { padding: 20px; flex: 1; }
        .kds-card-footer { padding: 15px 20px; background: #0F172A; border-top: 1px solid #334155; }
        
        .custom-checkbox { font-size: 18px; font-weight: 500; color: #F8FAFC; margin-bottom: 12px; display: block; cursor: pointer; }
        .cooking-note { background: #450A0A; border-left: 4px solid #DC2626; color: #FCA5A5; padding: 10px 15px; border-radius: 4px; font-size: 14px; font-weight: 500; margin-top: 15px; }

        /* Custom Scrollbar for Kitchen */
        .kds-main::-webkit-scrollbar { width: 8px; }
        .kds-main::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
    </style>
</head>
<body class="kds-theme">

    <!-- ============================================== -->
    <!-- 0. KITCHEN SECURE PIN OVERLAY -->
    <!-- ============================================== -->
    <div id="kitchen-login-screen" class="fullscreen-overlay" style="background: #0F172A; z-index: 9999; display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
        <div class="modal-card text-center shadow-lg" style="width: 100%; max-width: 380px; padding: 40px 30px; background: #1E293B; border-radius: 16px; border: 1px solid #334155;">
            <div class="logo-container mx-auto mb-4" style="width: 80px; height: 80px; background: #0F172A; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #334155;">
                <i class="fa-solid fa-fire-burner text-danger fa-3x"></i>
            </div>
            <h2 class="mb-2" style="color: white; font-weight: 700;">Kitchen Display</h2>
            <p class="text-muted text-sm mb-4" style="color: #94A3B8;">Enter 4-Digit Chef PIN</p>
            
            <input type="password" id="kitchen-passcode" class="mx-auto" placeholder="••••" maxlength="4" inputmode="numeric" pattern="[0-9]*" style="font-size: 36px; text-align: center; letter-spacing: 16px; font-weight: bold; padding: 15px; width: 220px; display: block; border-radius: 12px; border: 2px solid #475569; background: #0F172A; color: white; outline: none; margin-bottom: 15px;" autocomplete="off">
            
            <p id="kitchen-login-error" class="text-danger text-sm hidden mt-2" style="font-weight: 500;">Incorrect PIN!</p>
            
            <button id="btn-kitchen-login" class="btn-primary btn-large w-100 mt-4" style="padding: 14px; border-radius: 10px; font-size: 16px; background: #DC2626; border: none;">
                <i class="fa-solid fa-unlock-keyhole"></i> Enter Kitchen
            </button>
        </div>
    </div>

    <!-- 1. HIDDEN AUDIO TAG (For Loud Kitchen Bell) -->
    <audio id="kds-audio-bell" loop preload="auto">
        <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg">
    </audio>

    <!-- 2. KDS TOP HEADER -->
    <header class="kds-header">
        <div class="header-left" style="display: flex; align-items: center; gap: 15px;">
            <i class="fa-solid fa-fire-burner text-danger" style="font-size: 28px;"></i>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Indian Food Forest - KDS</h1>
        </div>
        
        <div class="header-right" style="display: flex; align-items: center; gap: 20px;">
            <button id="btn-toggle-sound" class="btn-outline-danger" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-volume-xmark"></i> Sound Off (Tap to Enable)
            </button>
            <div class="live-clock" id="kds-live-clock">
                00:00:00 AM
            </div>
        </div>
    </header>

    <!-- 3. MAIN KDS GRID -->
    <main class="kds-main">
        
        <!-- Empty State -->
        <div id="kds-empty-state" class="empty-state text-center">
            <i class="fa-solid fa-mug-hot"></i>
            <h2 style="color: #94A3B8; font-size: 28px;">Kitchen is clear!</h2>
            <p style="color: #64748B; font-size: 16px;">Waiting for new orders...</p>
        </div>

        <!-- Orders Grid Container -->
        <div id="kds-orders-grid" class="kds-grid hidden"></div>
        
    </main>

    <!-- JavaScript Files -->
    <script type="module" src="js/firebase-config.js"></script>
    <script type="module" src="js/kitchen-app.js"></script>

</body>
</html>
