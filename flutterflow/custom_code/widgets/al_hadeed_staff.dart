// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedStaff                     ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// FlutterFlow looks for a class with exactly the name typed in the
// "Custom Widget" box. The default is "NewCustomWidget", and leaving
// it there is what produces:
//
//     No widget "NewCustomWidget" found.
//
// So set the name field to:
//
//     AlHadeedStaff
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// The desks on a phone — cashier, accounts, store, manager.


// The shared core below is identical in all five screen files, so each
// file carries a few helpers it does not use itself. That is an analyzer
// warning, not an error, and silencing it keeps real warnings visible.
// ignore_for_file: unused_element

import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════
//  WHERE THE API LIVES
//
//  The one line to change when you deploy. Must match the value in
//  al_hadeed_shop.dart, al_hadeed_cart.dart,
//  al_hadeed_orders.dart and al_hadeed_company.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'https://pearlfx.online';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_manager.dart' show AlHadeedManager;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF5F7FB);
const Color _ink = Color(0xFF0F1B33);
const Color _inkSoft = Color(0xFF394862);
const Color _mid = Color(0xFF55637D);
const Color _light = Color(0xFF626F88);
const Color _hairline = Color(0xFFE2E8F2);
const Color _tile = Color(0xFFF9FAFD);
const Color _navy = Color(0xFF0E201A);
const Color _navyDark = Color(0xFF081511);
// #92D050 is the shop's green. It is light, so what sits on it is dark
// (_onLime); green words and marks on white use the deeper _brand.
const Color _lime = Color(0xFF92D050);
const Color _onLime = Color(0xFF102108);
const Color _brand = Color(0xFF3F7A12);
const Color _brandDark = Color(0xFF2F5E0C);
const Color _brandPale = Color(0xFFF0F8E6);
const Color _green = Color(0xFF0E7444);
const Color _greenPale = Color(0xFFE6F6ED);
const Color _blue = Color(0xFF0B658D);
const Color _bluePale = Color(0xFFE3F3FB);
const Color _amber = Color(0xFF9A5205);
const Color _amberPale = Color(0xFFFEF3E0);
const Color _ember = Color(0xFFC02B2B);
const Color _emberPale = Color(0xFFFDECEC);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

/// Soft depth for cards: a tight contact shadow and a wide faint one —
/// the same layered shadow the staff panel's cards use.
const List<BoxShadow> _cardShadow = [];

/// The brand's blue, deepening — hero cards, the header, the add button.
const LinearGradient _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_lime, _lime],
);

double _ui = 1.0;

bool get _isApple =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS);

double _trackingFor(double s) {
  if (s >= 24) return -0.025;
  if (s >= 20) return -0.020;
  if (s >= 17) return -0.013;
  if (s >= 15) return -0.007;
  if (s >= 13) return 0.0;
  return 0.008;
}

TextStyle _font(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = _inkSoft,
  double height = 1.3,
}) {
  final s = size * _ui * 0.92; // one size step smaller everywhere
  return TextStyle(
    fontFamily: _isApple ? (s >= 20 ? '.SF Pro Display' : '.SF Pro Text') : null,
    fontFamilyFallback: _isApple
        ? const ['.SF UI Display', '.SF UI Text', 'Helvetica Neue']
        : null,
    fontSize: s,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: s * _trackingFor(s),
  );
}

TextStyle _title(double size,
        {FontWeight weight = FontWeight.w700, Color color = _ink}) =>
    _font(size, weight: weight, color: color, height: 1.15);

TextStyle _txt(double size,
        {FontWeight weight = FontWeight.w400,
        Color color = _inkSoft,
        double height = 1.3}) =>
    _font(size, weight: weight, color: color, height: height);

BoxDecoration _liquid({
  Color? tint,
  bool onDark = false,
  double radius = 999,
  bool circle = false,
}) {
  final List<Color> fill;
  final Color rim;
  if (tint != null) {
    fill = [tint, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.16), _white.withOpacity(0.16)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, _white];
    rim = _ink.withOpacity(0.10);
  }
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: fill,
    ),
    shape: circle ? BoxShape.circle : BoxShape.rectangle,
    borderRadius: circle ? null : BorderRadius.circular(radius),
    border: Border.all(color: rim, width: 1),
  );
}

class _GradientRim extends BoxBorder {
  const _GradientRim(this.gradient, {this.width = 1});

  final Gradient gradient;
  final double width;

  @override
  BorderSide get top => BorderSide.none;
  @override
  BorderSide get bottom => BorderSide.none;
  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(width);
  @override
  bool get isUniform => true;

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    ui.TextDirection? textDirection,
    BoxShape shape = BoxShape.rectangle,
    BorderRadius? borderRadius,
  }) {
    final paint = Paint()
      ..strokeWidth = width
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke;
    final inner = rect.deflate(width / 2);
    if (borderRadius != null) {
      canvas.drawRRect(borderRadius.toRRect(inner), paint);
    } else {
      canvas.drawRect(inner, paint);
    }
  }

  @override
  ShapeBorder scale(double t) => _GradientRim(gradient, width: width * t);
}

class _Glass extends StatelessWidget {
  const _Glass({
    required this.child,
    this.height,
    this.radius = 22,
    this.blur = 24,
    this.padding,
  });

  final Widget child;
  final double? height;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_white, _white],
              ),
              border: _GradientRim(
                LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_white.withOpacity(0.95), _ink.withOpacity(0.12)],
                ),
              ),
            ),
            child: child,
          ),
        ),
      );
}

class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, this.onTap, this.scale = 0.96});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onTap!();
              },
        child: AnimatedScale(
          scale: _down ? widget.scale : 1.0,
          duration: Duration(milliseconds: _down ? 100 : 160),
          curve: _ease,
          child: widget.child,
        ),
      );
}

class _Skeleton extends StatefulWidget {
  const _Skeleton(this.width, this.height, {this.radius = 12});

  final double width;
  final double height;
  final double radius;

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          width: widget.width == 0 ? null : widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(_tile, _hairline, _c.value),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
}

/// A text field styled to match the tiles, with no Material underline
/// or outline fighting the flat look.
class _Field extends StatelessWidget {
  const _Field({
    super.key,
    required this.controller,
    this.obscure = false,
    required this.hint,
    this.validator,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.autofocus = false,
    this.onChanged,
    this.capitalisation = TextCapitalization.none,
  });

  final TextEditingController controller;
  final bool obscure;
  final String hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool autofocus;
  final ValueChanged<String>? onChanged;
  final TextCapitalization capitalisation;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        validator: validator,
        obscureText: obscure,
        autocorrect: !obscure,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        autofocus: autofocus,
        onChanged: onChanged,
        textCapitalization: capitalisation,
        cursorColor: _brand,
        style: _txt(15, color: _ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: _txt(15, color: _light),
          counterText: '',
          filled: true,
          fillColor: _tile,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _brand, width: 1.5),
          ),
          errorStyle: _txt(12, color: _ember),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  THE API
// ═══════════════════════════════════════════════════════════════

class _ApiError implements Exception {
  _ApiError(this.message, {this.unauthorised = false, this.code});
  final String message;
  final String? code;
  final bool unauthorised;
  @override
  String toString() => message;
}

/// The API answers `{ ...data }` or `{ "error": "in plain words" }`, so a
/// failure arrives with the wording the server wrote — including the
/// spending-limit and out-of-stock messages, which explain themselves far
/// better than a status code would.
Map<String, dynamic> _unwrap(http.Response res) {
  Map<String, dynamic> body;
  try {
    body = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {
    throw _ApiError('The server sent something unexpected. Try again.');
  }

  final error = body['error'];
  if (error != null) {
    throw _ApiError(
      error is String ? error : 'Something went wrong.',
      unauthorised: res.statusCode == 401,
      code: body['code']?.toString(),
    );
  }
  return body;
}

Map<String, String> _headers({bool json = false}) => {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      if (_Session().token != null)
        'Authorization': 'Bearer ${_Session().token}',
    };

Future<Map<String, dynamic>> _apiGet(String path) async {
  try {
    final res = await http
        .get(Uri.parse(_apiBase).resolve(path), headers: _headers())
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiSend(
    String method, String path, Object body) async {
  try {
    final uri = Uri.parse(_apiBase).resolve(path);
    final headers = _headers(json: true);
    final payload = jsonEncode(body);
    final res = await switch (method) {
      'PATCH' => http.patch(uri, headers: headers, body: payload),
      'DELETE' => http.delete(uri, headers: headers, body: payload),
      _ => http.post(uri, headers: headers, body: payload),
    }
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiPost(String path, Object body) =>
    _apiSend('POST', path, body);

// ═══════════════════════════════════════════════════════════════
//  MONEY
// ═══════════════════════════════════════════════════════════════

String _ugx(int amount) =>
    'UGX ${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

String _shortUgx(int amount) {
  if (amount >= 1000000) {
    final m = amount / 1000000;
    final t = m >= 100 || m == m.roundToDouble()
        ? m.round().toString()
        : m.toStringAsFixed(1);
    return 'UGX ${t}M';
  }
  if (amount >= 1000) return 'UGX ${(amount / 1000).round()}K';
  return 'UGX $amount';
}

/// "09:26" from the API's "2026-11-19 09:26:41".
String _shortTime(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  return stamp.substring(11, 16);
}

/// "19 Nov, 09:26" — enough to tell two orders apart without the year
/// taking up half the row.
String _when(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final month = int.tryParse(stamp.substring(5, 7)) ?? 1;
  final day = stamp.substring(8, 10);
  return '${int.parse(day)} ${months[month - 1]}, ${stamp.substring(11, 16)}';
}

// ═══════════════════════════════════════════════════════════════
//  WHO IS SIGNED IN
// ═══════════════════════════════════════════════════════════════

/// The signed-in customer, kept on the phone so the app opens straight
/// into the shop rather than asking for a code every time.
class _Session extends ChangeNotifier {
  factory _Session() => _instance;
  _Session._();
  static final _Session _instance = _Session._();

  static const _kToken = 'alhadeed.token';
  static const _kUser = 'alhadeed.user';

  SharedPreferences? _prefs;
  String? token;
  Map<String, dynamic>? user;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs!.getString(_kToken);
    final raw = _prefs!.getString(_kUser);
    if (raw != null) {
      try {
        user = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        user = null;
      }
    } else {
      user = null;
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;

  /// 'customer', or the desk: 'store' | 'cashier' | 'accounts' | 'manager'.
  String get role => user?['role'] as String? ?? 'customer';
  bool get isStaff => signedIn && role != 'customer';
  String get fullName => user?['fullName'] as String? ?? '';
  String get phone => user?['phone'] as String? ?? '';
  String get accountType => user?['accountType'] as String? ?? 'individual';
  bool get isCompany => accountType != 'individual';
  bool get isCompanyOwner => accountType == 'company_owner';
  String? get staffRole => user?['staffRole'] as String?;
  int? get spendingLimit => (user?['spendingLimit'] as num?)?.toInt();
  // The sign-in response carries companyId but not the company's name, so
  // the name is fetched from /auth/me right after signing in and kept
  // alongside it. Both shapes are read here so an older stored session
  // still shows something sensible.
  String get companyName =>
      user?['companyName'] as String? ??
      (user?['company'] as Map<String, dynamic>?)?['company_name']
          as String? ??
      'Company account';

  /// The line under the logo. A company's buyer can see at a glance
  /// whose account an order will land on.
  String get subtitle {
    if (!signedIn) return 'Browse the shop, sign in to order';
    if (!isCompany) return fullName;
    if (isCompanyOwner) return '$companyName · Owner view';
    return '$companyName · ordering as $fullName'
        '${staffRole == null ? '' : ' ($staffRole)'}';
  }

  Future<void> save(String newToken, Map<String, dynamic> newUser) async {
    _prefs ??= await SharedPreferences.getInstance();
    token = newToken;
    user = newUser;
    await _prefs!.setString(_kToken, newToken);
    await _prefs!.setString(_kUser, jsonEncode(newUser));
    notifyListeners();
  }

  Future<void> signOut() async {
    _prefs ??= await SharedPreferences.getInstance();
    token = null;
    user = null;
    await _prefs!.remove(_kToken);
    await _prefs!.remove(_kUser);
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE CART
// ═══════════════════════════════════════════════════════════════

/// Kept on the phone, not on the server: a cart is a private scribble
/// until it is submitted, and losing it to a dropped connection on the
/// way to the shop would be its own small disaster.
class _CartStore extends ChangeNotifier {
  factory _CartStore() => _instance;
  _CartStore._();
  static final _CartStore _instance = _CartStore._();

  static const _key = 'alhadeed.cart';
  SharedPreferences? _prefs;
  List<Map<String, dynamic>> lines = [];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      try {
        lines = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      } catch (_) {
        lines = [];
      }
    }
    notifyListeners();
  }

  Future<void> _save() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_key, jsonEncode(lines));
    notifyListeners();
  }

  int get count => lines.fold(0, (n, l) => n + (l['quantity'] as int));

  int get subtotal =>
      lines.fold(0, (n, l) => n + (l['price'] as int) * (l['quantity'] as int));

  int quantityOf(int productId) {
    for (final l in lines) {
      if (l['productId'] == productId) return l['quantity'] as int;
    }
    return 0;
  }

  Future<void> add(Map<String, dynamic> product, int quantity) async {
    final id = (product['id'] as num).toInt();
    final existing = lines.indexWhere((l) => l['productId'] == id);
    if (existing >= 0) {
      lines[existing]['quantity'] =
          (lines[existing]['quantity'] as int) + quantity;
    } else {
      lines.add({
        'productId': id,
        'name': product['name'],
        'unit': product['unit'],
        'code': product['code'],
        'category': product['category_name'],
        'price': (product['price'] as num).toInt(),
        'quantity': quantity,
      });
    }
    await _save();
  }

  Future<void> setQuantity(int productId, int quantity) async {
    final i = lines.indexWhere((l) => l['productId'] == productId);
    if (i < 0) return;
    if (quantity <= 0) {
      lines.removeAt(i);
    } else {
      lines[i]['quantity'] = quantity;
    }
    await _save();
  }

  Future<void> clear() async {
    lines = [];
    await _save();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED PIECES
// ═══════════════════════════════════════════════════════════════

/// A colour per category, so cement is always grey-blue and paint is
/// always violet. Hashed from the name rather than hard-coded, because
/// the Manager can add a category on the web panel at any time.
Color _categoryColour(String? name) {
  const palette = [
    Color(0xFF4A6E8A),
    Color(0xFF8A5A3C),
    Color(0xFF3F7F6B),
    Color(0xFF8A6FAE),
    Color(0xFF2F6E9E),
    Color(0xFFB07A2A),
    Color(0xFF5B6E7F),
  ];
  if (name == null || name.isEmpty) return palette[0];
  var h = 0;
  for (final c in name.codeUnits) {
    h = (h * 31 + c) & 0x7FFFFFFF;
  }
  return palette[h % palette.length];
}

/// One colour pair per status, used on every screen, so a chip means the
/// same thing wherever it turns up.
(Color, Color) _statusColours(String status) => switch (status) {
      'pending_payment' => (_amberPale, _amber),
      'paid' => (_bluePale, _blue),
      'payment_verified' => (_bluePale, _blue),
      'packed' => (_bluePale, _blue),
      'released' => (_greenPale, _green),
      'cancelled' => (_emberPale, _ember),
      'rejected' => (_emberPale, _ember),
      _ => (_tile, _mid),
    };

String _statusLabel(String status) => switch (status) {
      'pending_payment' => 'Pending payment',
      'paid' => 'Paid',
      'payment_verified' => 'Verifying',
      'packed' => 'Being packed',
      'released' => 'Completed',
      'cancelled' => 'Cancelled',
      'rejected' => 'Payment rejected',
      _ => status,
    };

class _Chip extends StatelessWidget {
  const _Chip(this.label,
      {required this.bg, required this.fg, this.bold = true});

  final String label;
  final Color bg;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: _txt(11.5,
              weight: bold ? FontWeight.w700 : FontWeight.w500, color: fg),
        ),
      );
}

/// The bottom bar. Four screens, and everything else the app does is a
/// sheet that slides over whichever one you are on — so you never lose
/// your place to look something up.
///
/// The other three screens are reached by their widget class, which is
/// the only thing FlutterFlow lets cross between custom widget files.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current});

  /// 'shop' | 'cart' | 'orders' | 'company'
  final String current;

  void _go(BuildContext context, Widget page) =>
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => page,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ));

  @override
  Widget build(BuildContext context) {
    final owner = _Session().isCompanyOwner;
    // Outline when idle, filled where you are.
    final items = <(String, String, IconData, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, Icons.storefront_rounded,
          const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined,
          Icons.shopping_cart_rounded, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined,
          Icons.receipt_long_rounded, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        owner ? Icons.business_rounded : Icons.person_rounded,
        const AlHadeedCompany()
      ),
    ];

    // A floating bar rather than a slab across the bottom: it sits on
    // the page, and the tab you are on is lit by a soft pill.
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 6, 16, MediaQuery.paddingOf(context).bottom + 10),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _hairline),
        ),
        child: Row(
          children: [
            for (final (key, label, icon, iconOn, page) in items)
              Expanded(
                child: _Pressable(
                  scale: 0.94,
                  onTap: key == current ? null : () => _go(context, page),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: _ease,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color:
                          key == current ? _brandPale : _white.withOpacity(0),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(key == current ? iconOn : icon,
                                size: 21,
                                color: key == current ? _brand : _light),
                            if (key == 'cart')
                              ListenableBuilder(
                                listenable: _CartStore(),
                                builder: (_, __) {
                                  final n = _CartStore().count;
                                  if (n == 0) return const SizedBox.shrink();
                                  return Positioned(
                                    right: -9,
                                    top: -6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        gradient: _heroGradient,
                                        borderRadius: BorderRadius.circular(9),
                                        border:
                                            Border.all(color: _onLime, width: 2),
                                      ),
                                      constraints:
                                          const BoxConstraints(minWidth: 19),
                                      child: Text('$n',
                                          textAlign: TextAlign.center,
                                          style: _txt(10,
                                              weight: FontWeight.w800,
                                              color: _onLime)),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(label,
                            style: _txt(10.5,
                                weight: key == current
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: key == current ? _brand : _light)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// The header every screen wears: the brand's blue, rounded at its foot.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_lime, _lime],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
        ),
        child: Stack(
          children: [
            // A soft light in the corner, so the blue has depth rather
            // than being a flat slab.
            Positioned(
              right: -60,
              top: -90,
              child: Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    _white.withOpacity(0),
                    _white.withOpacity(0),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, MediaQuery.paddingOf(context).top + 10, 14, 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _onLime.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _onLime.withOpacity(0.18)),
                    ),
                    child: Text('AH',
                        style: _title(14,
                            weight: FontWeight.w800, color: _onLime)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Al Hadeed Hardware',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _title(17,
                                weight: FontWeight.w800, color: _onLime)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _txt(12.5, color: _onLime.withOpacity(0.92))),
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          ],
        ),
      );
}

/// Every screen's "nothing here yet" and "that did not work" state.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.line,
    this.action,
    this.onAction,
    this.tone = _mid,
  });

  final IconData icon;
  final String title;
  final String line;
  final String? action;
  final VoidCallback? onAction;
  final Color tone;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // A soft rounded tile with a ring, not a flat grey disc.
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: tone == _ember
                        ? [_emberPale, _emberPale]
                        : [_brandPale, _brandPale],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                      color: tone == _ember
                          ? _ember.withOpacity(0.18)
                          : _brand.withOpacity(0.14)),
                ),
                child: Icon(icon,
                    size: 32, color: tone == _ember ? _ember : _brand),
              ),
              const SizedBox(height: 16),
              Text(title, textAlign: TextAlign.center, style: _title(19)),
              const SizedBox(height: 8),
              Text(line,
                  textAlign: TextAlign.center,
                  style: _txt(13.5, color: _mid, height: 1.5)),
              if (action != null) ...[
                const SizedBox(height: 20),
                _Pressable(
                  scale: 0.98,
                  onTap: onAction,
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    alignment: Alignment.center,
                    decoration: _liquid(tint: _lime, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _onLime)),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

/// The shell every sheet in the app sits in: grab handle, rounded top,
/// lifted clear of the keyboard.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    return Padding(
      // Lifts the sheet above the keyboard, or the submit button sits
      // under it and cannot be reached.
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        clipBehavior: Clip.antiAlias,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                decoration: BoxDecoration(
                  color: _hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE STAFF SIDE
// ═══════════════════════════════════════════════════════════════

/// What staff see instead of the shop.
///
/// The customer screens hand over to this the moment the session belongs
/// to a desk. It replaces them rather than being opened on top, so there
/// is no shop underneath to go back to; the only way out is signing out.
/// Each desk gets its own bar. The server checks the desk on every
/// request as well — this decides what is drawn, not what is allowed.
class AlHadeedStaff extends StatefulWidget {
  const AlHadeedStaff({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on.
  final double? width;
  final double? height;

  @override
  State<AlHadeedStaff> createState() => _AlHadeedStaffState();
}

typedef _TabSpec = (String, IconData, IconData, Widget);

class _AlHadeedStaffState extends State<AlHadeedStaff> {
  int _tab = 0;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _Session().load().then((_) {
      if (mounted) setState(() => _ready = true);
    });
  }

  Future<void> _signOut() async {
    final navigator = Navigator.of(context);
    await _Session().signOut();
    await _CartStore().clear();
    if (!mounted) return;
    navigator.pushReplacement(PageRouteBuilder(
      pageBuilder: (_, __, ___) => const AlHadeedShop(),
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
    ));
  }

  List<_TabSpec> get _tabs {
    final desk = _Session().role;
    final out = _signOut;
    final account = (
      'Account',
      Icons.person_outline_rounded,
      Icons.person_rounded,
      _AccountTab(onSignOut: _signOut),
    );
    _ListTab orders(String title, String path, String empty,
            {String? action, bool deliver = false}) =>
        _ListTab(
          title: title,
          path: path,
          listKey: 'orders',
          empty: empty,
          onExpired: out,
          row: (o, reload) => _OrderCard(o, action: action, done: reload),
        );
    _ListTab requests() => _ListTab(
          title: 'Expenses',
          path: '/api/expenses?status=all',
          listKey: 'expenses',
          empty: 'No expenses yet',
          onExpired: out,
          row: (e, reload) => _RequestCard(e, desk: desk, done: reload),
          add: 'Add expense',
          addSheet: (_) => const _RequestSheet(),
        );

    return switch (desk) {
      'store' => [
          (
            'Find order',
            Icons.qr_code_scanner_rounded,
            Icons.qr_code_scanner_rounded,
            _FindOrderTab(onExpired: out)
          ),
          (
            'To release',
            Icons.inventory_2_outlined,
            Icons.inventory_2_rounded,
            orders('To release', '/api/store/queue', 'Nothing to release',
                action: 'release')
          ),
          (
            'Released',
            Icons.task_alt_outlined,
            Icons.task_alt_rounded,
            orders('Released', '/api/orders/queue/done', 'Nothing released yet')
          ),
          (
            'Expenses',
            Icons.playlist_add_rounded,
            Icons.playlist_add_check_rounded,
            requests()
          ),
          account,
        ],
      'cashier' => [
          (
            'To pay',
            Icons.payments_outlined,
            Icons.payments_rounded,
            orders('Waiting to pay', '/api/cashier/queue', 'Nobody is waiting',
                action: 'pay')
          ),
          (
            'Receipts',
            Icons.receipt_outlined,
            Icons.receipt_rounded,
            _ListTab(
              title: 'Receipts today',
              path: '/api/cashier/receipts',
              listKey: 'receipts',
              empty: 'No receipts yet today',
              onExpired: out,
              row: (r, _) => _PlainCard(
                title: '${r['receipt_no']} · ${r['order_no'] ?? ''}',
                line: [
                  r['company_name'] ?? r['customer_name'],
                  _method(r['method']),
                  r['transaction_ref'],
                  _shortTime(r['created_at']?.toString()),
                ],
                amount: _int(r['amount_paid']),
              ),
            )
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
      'accounts' => [
          (
            'To verify',
            Icons.fact_check_outlined,
            Icons.fact_check_rounded,
            orders('To verify', '/api/accounts/queue', 'Nothing to check',
                action: 'verify')
          ),
          (
            'Cash book',
            Icons.menu_book_outlined,
            Icons.menu_book_rounded,
            _ListTab(
              title: 'Cash book today',
              path: '/api/accounts/cash-book',
              listKey: 'entries',
              empty: 'Nothing in the book today',
              onExpired: out,
              summary: (d) => [
                ('Opening', _ugx(_int(d['opening']))),
                ('Closing', _ugx(_int(d['closing']))),
              ],
              row: (e, _) => _PlainCard(
                title: e['details']?.toString() ?? '',
                line: [
                  _method(e['method']),
                  _shortTime(e['created_at']?.toString()),
                ],
                amount: _int(e['cash_in']) > 0
                    ? _int(e['cash_in'])
                    : -_int(e['cash_out']),
              ),
            )
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
      _ => [
          (
            'Home',
            Icons.dashboard_outlined,
            Icons.dashboard_rounded,
            const AlHadeedManager()
          ),
          (
            'Orders',
            Icons.receipt_long_outlined,
            Icons.receipt_long_rounded,
            orders('All orders', '/api/orders?limit=100', 'No orders yet')
          ),
          (
            'Stock',
            Icons.inventory_2_outlined,
            Icons.inventory_2_rounded,
            _StockTab(onExpired: out)
          ),
          (
            'Workers',
            Icons.badge_outlined,
            Icons.badge_rounded,
            _WorkersTab(onExpired: out)
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
    };
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    if (!_ready || !_Session().signedIn) return Container(color: _bg);

    final tabs = _tabs;
    final at = _tab.clamp(0, tabs.length - 1);

    return PopScope(
      // The phone's back button goes to the first tab, then nowhere: the
      // shop is not behind this.
      canPop: false,
      onPopInvokedWithResult: (did, _) {
        if (!did && _tab != 0) setState(() => _tab = 0);
      },
      child: MediaQuery(
        data: mq.copyWith(
          textScaler:
              mq.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.2),
        ),
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light
              .copyWith(statusBarColor: Colors.transparent),
          child: Container(
            width: widget.width ?? mq.size.width,
            height: widget.height ?? mq.size.height,
            color: _bg,
            child: Scaffold(
              backgroundColor: _bg,
              // Keyed, so each tab asks the shop afresh when opened.
              body: KeyedSubtree(key: ValueKey(at), child: tabs[at].$4),
              bottomNavigationBar: _bar(tabs, at, mq),
            ),
          ),
        ),
      ),
    );
  }

  /// The same bar as the customers' side, so the whole app matches.
  Widget _bar(List<_TabSpec> tabs, int at, MediaQueryData mq) => Padding(
        padding: EdgeInsets.fromLTRB(16, 6, 16, mq.padding.bottom + 10),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _hairline),
          ),
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: _Pressable(
                    scale: 0.94,
                    onTap: i == at ? null : () => setState(() => _tab = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: _ease,
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: i == at ? _brandPale : _white.withOpacity(0),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(i == at ? tabs[i].$3 : tabs[i].$2,
                              size: 21,
                              color: i == at ? _brand : _light),
                          const SizedBox(height: 3),
                          Text(tabs[i].$1,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _txt(10.5,
                                  weight: i == at
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: i == at ? _brand : _light)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

int _int(Object? v) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? 0;

/// Quantities can be part units: half a length, half a sheet.
double _num(Object? v) =>
    v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

/// "2", "2.5": no trailing zeros.
String _qtyText(num n) {
  final r = (n * 100).round() / 100;
  return r == r.roundToDouble() ? r.toInt().toString() : r.toString();
}

/// Half steps for an item sold in halves, whole steps otherwise.
double _step(Map<String, dynamic> item) =>
    _num(item['quantity']) % 1 == 0 && _num(item['qty_released']) % 1 == 0 ? 1 : 0.5;

String _method(Object? m) => switch (m?.toString()) {
      'mobile_money' => 'Mobile Money',
      'mtn_momo' => 'MTN Mobile Money',
      'airtel_money' => 'Airtel Money',
      'bank' => 'Bank transfer',
      'cheque' => 'Cheque',
      'cash' => 'Cash',
      'card' => 'Card',
      null || '' => '',
      final other => other,
    };

String _deskName(String role) => switch (role) {
      'store' => 'Store Manager',
      'cashier' => 'Cashier',
      'accounts' => 'Accounts',
      _ => 'Manager',
    };

/// One tab: a header, what the shop answered, and every state between.
class _ListTab extends StatefulWidget {
  const _ListTab({
    required this.title,
    required this.path,
    required this.listKey,
    required this.empty,
    required this.row,
    required this.onExpired,
    this.summary,
    this.add,
    this.addSheet,
  });

  final String title;
  final String path;
  final String listKey;
  final String empty;
  final Widget Function(Map<String, dynamic>, Future<void> Function()) row;
  final Future<void> Function() onExpired;
  final List<(String, String)> Function(Map<String, dynamic>)? summary;
  final String? add;
  final WidgetBuilder? addSheet;

  @override
  State<_ListTab> createState() => _ListTabState();
}

class _ListTabState extends State<_ListTab> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet(widget.path);
      if (!mounted) return;
      setState(() {
        _data = r;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await widget.onExpired();
        return;
      }
      setState(() => _error = e.message);
    }
  }

  Future<void> _add() async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: widget.addSheet!,
    );
    if (done == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final rows = ((_data?[widget.listKey] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();

    return Column(
      children: [
        _Header(
          subtitle:
              '${_deskName(_Session().role)} · ${_Session().fullName}',
          trailing: _Pressable(
            scale: 0.9,
            onTap: _load,
            child: Container(
              width: 38,
              height: 38,
              decoration: _liquid(circle: true, onDark: true),
              child:
                  const Icon(Icons.refresh_rounded, size: 19, color: _onLime),
            ),
          ),
        ),
        Expanded(
          // A failure is never drawn as an empty list: "nobody is waiting"
          // on a dropped connection would be a lie.
          child: _data == null && _error != null
              ? _Empty(
                  icon: Icons.cloud_off_rounded,
                  tone: _ember,
                  title: 'This could not be loaded',
                  line: _error!,
                  action: 'Try again',
                  onAction: _load,
                )
              : _data == null
                  ? const Center(
                      child: CircularProgressIndicator(color: _brand))
                  : RefreshIndicator(
                      color: _brand,
                      onRefresh: _load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(12, 14, 12, 20),
                        children: [
                          Row(
                            children: [
                              Expanded(
                                  child: Text(widget.title,
                                      style: _title(20,
                                          weight: FontWeight.w800))),
                              if (widget.add != null)
                                _SmallButton(widget.add!, _add)
                              else
                                Text('${rows.length}',
                                    style: _title(16, color: _mid)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_error != null) ...[
                            Text('Not up to date: $_error',
                                style: _txt(12.5, color: _ember)),
                            const SizedBox(height: 10),
                          ],
                          if (widget.summary != null)
                            for (final (k, v) in widget.summary!(_data!))
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(children: [
                                  Text(k, style: _txt(13.5, color: _mid)),
                                  const Spacer(),
                                  Text(v, style: _title(15)),
                                ]),
                              ),
                          if (rows.isEmpty)
                            _Empty(
                              icon: Icons.inbox_outlined,
                              title: widget.empty,
                              line: 'Pull down to check again.',
                            ),
                          for (final r in rows) widget.row(r, _load),
                        ],
                      ),
                    ),
        ),
      ],
    );
  }
}

BoxDecoration _cardBox() => BoxDecoration(
      color: _white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: _hairline.withOpacity(0.7)),
    );

class _SmallButton extends StatelessWidget {
  const _SmallButton(this.label, this.onTap);
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _Pressable(
        scale: 0.95,
        onTap: onTap,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: _liquid(tint: _lime, radius: 19),
          child: Text(label,
              style: _txt(13, weight: FontWeight.w700, color: _onLime)),
        ),
      );
}

/// The wide button at the foot of a sheet.
class _BigButton extends StatelessWidget {
  const _BigButton(this.label, this.onTap,
      {this.busy = false, this.tint = _lime, this.soft = false});
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  final Color tint;

  /// For the choice that is not the main one: pale, so two buttons side
  /// by side never shout at once.
  final bool soft;

  @override
  Widget build(BuildContext context) => _Pressable(
        scale: 0.98,
        onTap: busy ? null : onTap,
        child: Opacity(
          opacity: onTap == null && !busy ? 0.45 : 1,
          child: Container(
            height: 46,
            alignment: Alignment.center,
            decoration: soft
                ? BoxDecoration(
                    color: _emberPale,
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(color: tint.withOpacity(0.22)),
                  )
                : _liquid(tint: tint, radius: 25),
            child: busy
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: soft ? tint : tint == _lime ? _onLime : _white))
                : Text(label,
                    style: _txt(15,
                        weight: FontWeight.w600,
                        color: soft ? tint : tint == _lime ? _onLime : _white)),
          ),
        ),
      );
}

class _PlainCard extends StatelessWidget {
  const _PlainCard(
      {required this.title, required this.line, required this.amount});
  final String title;
  final List<Object?> line;
  final int amount;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: _cardBox(),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: _txt(14, weight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Text(
                      line
                          .where((x) => x != null && x.toString().isNotEmpty)
                          .join(' · '),
                      style: _txt(12, color: _mid)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(amount < 0 ? '-${_ugx(-amount)}' : _ugx(amount),
                style: _title(14.5, color: amount < 0 ? _ember : _ink)),
          ],
        ),
      );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard(this.order, {this.action, required this.done});
  final Map<String, dynamic> order;

  /// 'pay' | 'verify' | 'release', or null to only look.
  final String? action;
  final Future<void> Function() done;

  Future<void> _open(BuildContext context) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      // The store delivers by quantity, part now and part later.
      builder: (_) => action == 'release'
          ? _DeliverSheet(orderNo: '${order['order_no']}')
          : _OrderSheet(order: order, action: action),
    );
    if (changed == true) await done();
  }

  @override
  Widget build(BuildContext context) {
    final items = _int(order['item_count']);
    return _Pressable(
      scale: 0.98,
      onTap: () => _open(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: _cardBox(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text('${order['order_no']}',
                  style: _title(16, weight: FontWeight.w800)),
              const Spacer(),
              Text(_ugx(_int(order['total'])),
                  style: _title(16, weight: FontWeight.w800)),
            ]),
            const SizedBox(height: 5),
            Text(
                '${order['company_name'] ?? order['ordered_by_name'] ?? ''}',
                style: _txt(13.5, weight: FontWeight.w600)),
            const SizedBox(height: 4),
            Row(children: [
              Expanded(
                child: Text(
                    [
                      '$items ${items == 1 ? 'item' : 'items'}',
                      _when(order['created_at']?.toString()),
                      if (order['fulfilment'] == 'delivery') 'delivery',
                    ].join(' · '),
                    style: _txt(12, color: _mid)),
              ),
              if (action == null)
                // Coloured by what the status means: cancelled in red,
                // waiting for money in amber, done in green.
                _Chip('${order['status_label'] ?? ''}',
                    bg: _statusColours('${order['status']}').$1,
                    fg: _statusColours('${order['status']}').$2)
              else
                const Icon(Icons.chevron_right_rounded,
                    size: 20, color: _light),
            ]),
          ],
        ),
      ),
    );
  }
}

/// One order in full, and the one thing this desk does to it.
class _OrderSheet extends StatefulWidget {
  const _OrderSheet({required this.order, this.action});
  final Map<String, dynamic> order;
  final String? action;

  @override
  State<_OrderSheet> createState() => _OrderSheetState();
}

class _OrderSheetState extends State<_OrderSheet> {
  final _text = TextEditingController();
  Map<String, dynamic>? _full;
  String _how = 'cash';
  bool _busy = false;
  bool _rejecting = false;
  String? _error;
  final Set<int> _picked = {};

  int get _id => _int(widget.order['id']);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/orders/$_id');
      if (!mounted) return;
      setState(() {
        _full = (r['order'] as Map).cast<String, dynamic>();
        _error = null;
      });
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _send(String path, Map<String, dynamic> body) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(path, body);
      HapticFeedback.mediumImpact();
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  List<Map<String, dynamic>> get _items =>
      ((_full?['items'] as List?) ?? const [])
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();

  List<Widget> _actions() {
    final again = (_) => setState(() {});
    switch (widget.action) {
      case 'release':
        final all = _full != null &&
            _items.isNotEmpty &&
            _items.every((i) => _picked.contains(_int(i['id'])));
        return [
          _Field(
            controller: _text,
            hint: 'Who is collecting? (optional)',
            capitalisation: TextCapitalization.words,
          ),
          const SizedBox(height: 12),
          _BigButton(
            all ? 'Release the goods' : 'Tick every item first',
            all
                ? () => _send('/api/store/orders/$_id/release',
                    {'collectedBy': _text.text.trim()})
                : null,
            busy: _busy,
            tint: _green,
          ),
        ];
      case 'pay':
        final needsRef = _how != 'cash';
        final ok = _full != null &&
            (!needsRef || _text.text.trim().length >= 4);
        return [
          Row(children: [
            for (final m in const ['cash', 'mobile_money', 'card']) ...[
              Expanded(
                child: _Pressable(
                  scale: 0.96,
                  onTap: () => setState(() => _how = m),
                  child: Container(
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _how == m ? _lime : _tile,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _hairline),
                    ),
                    child: Text(_method(m),
                        maxLines: 1,
                        style: _txt(12.5,
                            weight: FontWeight.w700,
                            color: _how == m ? _onLime : _inkSoft)),
                  ),
                ),
              ),
              if (m != 'card') const SizedBox(width: 8),
            ],
          ]),
          if (needsRef) ...[
            const SizedBox(height: 10),
            _Field(
              controller: _text,
              hint: 'Transaction ID',
              capitalisation: TextCapitalization.characters,
              onChanged: again,
            ),
          ],
          const SizedBox(height: 12),
          _BigButton(
            'Received ${_ugx(_int(widget.order['total']))}',
            ok
                ? () => _send('/api/cashier/orders/$_id/payment', {
                      'method': _how,
                      'amountPaid': _int(_full!['total']),
                      'transactionRef': needsRef ? _text.text.trim() : null,
                    })
                : null,
            busy: _busy,
          ),
        ];
      case 'verify':
        if (_rejecting) {
          return [
            _Field(
              controller: _text,
              hint: 'Why is it going back? The cashier reads this.',
              maxLines: 2,
              autofocus: true,
              onChanged: again,
            ),
            const SizedBox(height: 12),
            _BigButton(
              'Send back to the cashier',
              _text.text.trim().length >= 3
                  ? () => _send('/api/accounts/orders/$_id/verify',
                      {'approve': false, 'remarks': _text.text.trim()})
                  : null,
              busy: _busy,
              tint: _ember,
            ),
            TextButton(
              onPressed: () => setState(() => _rejecting = false),
              child: Text('Back', style: _txt(13.5, color: _mid)),
            ),
          ];
        }
        return [
          _BigButton(
            'Money is in, verify',
            _full == null
                ? null
                : () => _send('/api/accounts/orders/$_id/verify',
                    {'approve': true}),
            busy: _busy,
            tint: _green,
          ),
          Center(
            child: TextButton(
              onPressed: _busy ? null : () => setState(() => _rejecting = true),
              child: Text('Something is wrong with it',
                  style: _txt(13.5, weight: FontWeight.w600, color: _ember)),
            ),
          ),
        ];
    }
    return const [];
  }

  String _act(String a) => switch (a) {
        'placed' => 'Order placed',
        'counter_sale' => 'Sale started at the counter',
        'payment_received' => 'Paid at the cashier',
        'verified' => 'Payment checked',
        'rejected' => 'Payment sent back',
        'part_released' => 'Part given out',
        'released' => 'Goods given out',
        'cancelled' => 'Cancelled',
        'looked_up' => 'Opened at the store',
        _ => a.replaceAll('_', ' '),
      };

  Widget _card(String title, List<Widget> children, {Widget? trailing}) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Text(title.toUpperCase(),
                  style: _txt(11, weight: FontWeight.w800, color: _light)),
              const Spacer(),
              if (trailing != null) trailing,
            ]),
            const SizedBox(height: 6),
            ...children,
          ],
        ),
      );

  Widget _kv(IconData icon, String k, Object? v, {VoidCallback? onTap, Color? color}) =>
      v == null || '$v'.isEmpty
          ? const SizedBox.shrink()
          : _Pressable(
              scale: onTap == null ? 1 : 0.98,
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 16, color: _mid),
                    const SizedBox(width: 8),
                    SizedBox(
                        width: 92,
                        child: Text(k, style: _txt(12.5, color: _mid))),
                    Expanded(
                      child: Text('$v',
                          style: _txt(12.5,
                              weight: FontWeight.w600,
                              color: color ?? _ink)),
                    ),
                    if (onTap != null)
                      const Icon(Icons.call_rounded, size: 16, color: _brand),
                  ],
                ),
              ),
            );

  void _showProof(String url) => showDialog<void>(
        context: context,
        builder: (c) => Dialog(
          insetPadding: const EdgeInsets.all(12),
          backgroundColor: Colors.black,
          child: Stack(children: [
            InteractiveViewer(
              child: Image.network(url, headers: _headers(), fit: BoxFit.contain),
            ),
            Positioned(
              right: 6,
              top: 6,
              child: IconButton(
                onPressed: () => Navigator.of(c).pop(),
                icon: const Icon(Icons.close_rounded, color: _white),
              ),
            ),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final o = _full ?? widget.order;
    final payment = (_full?['payment'] as Map?)?.cast<String, dynamic>();
    final events = ((_full?['events'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .where((e) => e['action'] != 'looked_up')
        .toList();
    final picking = widget.action == 'release';
    final status = '${o['status'] ?? ''}';
    final (sbg, sfg) = _statusColours(status);
    final phone = '${o['ordered_by_phone'] ?? ''}';
    final verified = _int(payment?['verified']);

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            16, 4, 16, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The order at a glance.
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: sbg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text('${o['order_no']}',
                        style: _title(21, weight: FontWeight.w800)),
                    const Spacer(),
                    _Chip('${o['status_label'] ?? _statusLabel(status)}',
                        bg: _white, fg: sfg),
                  ]),
                  const SizedBox(height: 6),
                  Text(_ugx(_int(o['total'])),
                      style: _title(24, weight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                      [
                        _when(o['created_at']?.toString()),
                        '${_int(o['item_count'])} items',
                        o['fulfilment'] == 'delivery' ? 'We deliver' : 'Collect',
                        if ('${o['source'] ?? ''}' == 'counter') 'At the counter'
                        else if ('${o['source'] ?? ''}'.isNotEmpty) 'On the app',
                      ].where((x) => x.isNotEmpty).join(' · '),
                      style: _txt(12, color: _inkSoft)),
                ],
              ),
            ),
            const SizedBox(height: 10),

            _card('Customer', [
              _kv(Icons.person_outline_rounded, 'Name',
                  o['company_name'] ?? o['ordered_by_name']),
              _kv(Icons.phone_iphone_rounded, 'Phone', phone,
                  onTap: phone.isEmpty ? null : () => launchURL('tel:$phone')),
              _kv(Icons.location_on_outlined, 'Deliver to', o['delivery_address']),
              _kv(Icons.sticky_note_2_outlined, 'Note', o['notes']),
              if ('${o['cancel_reason'] ?? ''}'.isNotEmpty)
                _kv(Icons.block_rounded, 'Why cancelled', o['cancel_reason'],
                    color: _ember),
            ]),

            if (_full == null && _error == null)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator(color: _brand)),
              ),

            if (_items.isNotEmpty)
              _card(
                picking ? 'Tick each item as it goes' : 'Items',
                [
                  for (final i in _items)
                    _Pressable(
                      scale: picking ? 0.99 : 1,
                      onTap: picking
                          ? () => setState(() {
                                final id = _int(i['id']);
                                if (!_picked.remove(id)) _picked.add(id);
                              })
                          : null,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(children: [
                          if (picking) ...[
                            Icon(
                                _picked.contains(_int(i['id']))
                                    ? Icons.check_circle_rounded
                                    : Icons.radio_button_unchecked_rounded,
                                size: 22,
                                color: _picked.contains(_int(i['id']))
                                    ? _green
                                    : _light),
                            const SizedBox(width: 10),
                          ],
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${i['product_name']}',
                                    style: _txt(13.5,
                                        weight: FontWeight.w600, color: _ink)),
                                Text(
                                    [
                                      '${_qtyText(_num(i['quantity']))} ${i['unit'] ?? ''} × ${_ugx(_int(i['unit_price']))}',
                                      if (_num(i['qty_released']) > 0)
                                        '${_qtyText(_num(i['qty_released']))} given out',
                                    ].join(' · '),
                                    style: _txt(11.5, color: _mid)),
                              ],
                            ),
                          ),
                          Text(_ugx(_int(i['line_total'])),
                              style: _txt(13, weight: FontWeight.w700, color: _ink)),
                        ]),
                      ),
                    ),
                  const Divider(height: 14, color: _hairline),
                  if (_int(o['delivery_fee']) > 0)
                    Row(children: [
                      Text('Delivery', style: _txt(12.5, color: _mid)),
                      const Spacer(),
                      Text(_ugx(_int(o['delivery_fee'])),
                          style: _txt(12.5, weight: FontWeight.w600)),
                    ]),
                  Row(children: [
                    Text('Total', style: _title(14)),
                    const Spacer(),
                    Text(_ugx(_int(o['total'])),
                        style: _title(15, weight: FontWeight.w800)),
                  ]),
                ],
              ),

            if (payment != null)
              _card(
                'Payment',
                [
                  _kv(Icons.receipt_long_outlined, 'Receipt', payment['receipt_no']),
                  _kv(Icons.payments_outlined, 'Paid by', _method(payment['method'])),
                  _kv(Icons.tag_rounded, 'Transaction ID', payment['transaction_ref']),
                  _kv(Icons.account_balance_wallet_outlined, 'Amount',
                      _ugx(_int(payment['amount_paid']))),
                  _kv(Icons.person_outline_rounded, 'Cashier', payment['cashier_name']),
                  _kv(Icons.schedule_rounded, 'Paid at',
                      _when(payment['created_at']?.toString())),
                  if (verified != 0)
                    _kv(Icons.fact_check_outlined, 'Checked by',
                        payment['verifier_name']),
                  if ('${payment['verify_remarks'] ?? ''}'.isNotEmpty)
                    _kv(Icons.comment_outlined, 'Remark', payment['verify_remarks']),
                  if (payment['has_proof'] == true) ...[
                    const SizedBox(height: 8),
                    _Pressable(
                      scale: 0.98,
                      onTap: () => _showProof(
                          '$_apiBase/api/payments/${payment['id']}/proof'),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Stack(children: [
                          SizedBox(
                            height: 150,
                            width: double.infinity,
                            child: Image.network(
                              '$_apiBase/api/payments/${payment['id']}/proof',
                              headers: _headers(),
                              fit: BoxFit.cover,
                              alignment: Alignment.topCenter,
                              errorBuilder: (_, __, ___) => Center(
                                child: Text(
                                    'The payment screenshot could not be shown.',
                                    style: _txt(12.5, color: _mid)),
                              ),
                            ),
                          ),
                          Positioned(
                            right: 8,
                            bottom: 8,
                            child: _Chip('Tap to see it all',
                                bg: _white.withOpacity(0.92), fg: _ink),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ],
                trailing: _Chip(
                  verified == 1
                      ? 'Checked'
                      : verified == -1
                          ? 'Sent back'
                          : 'Not checked yet',
                  bg: verified == 1
                      ? _greenPale
                      : verified == -1
                          ? _emberPale
                          : _amberPale,
                  fg: verified == 1
                      ? _green
                      : verified == -1
                          ? _ember
                          : _amber,
                ),
              ),

            if (events.isNotEmpty)
              _card('History', [
                for (var n = 0; n < events.length; n++)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(children: [
                        Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(top: 3),
                          decoration: BoxDecoration(
                            color: n == events.length - 1 ? _brand : _hairline,
                            shape: BoxShape.circle,
                          ),
                        ),
                        if (n < events.length - 1)
                          Container(width: 2, height: 30, color: _hairline),
                      ]),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_act('${events[n]['action']}'),
                                  style: _txt(12.5,
                                      weight: FontWeight.w700, color: _ink)),
                              Text(
                                  [
                                    _when(events[n]['created_at']?.toString()),
                                    if ('${events[n]['handler_name'] ?? ''}'.isNotEmpty)
                                      '${events[n]['handler_name']}',
                                  ].join(' · '),
                                  style: _txt(11.5, color: _mid)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
              ]),

            if (_error != null) ...[
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
              if (_full == null)
                TextButton(
                    onPressed: _load,
                    child: Text('Try again',
                        style: _txt(13.5, color: _brandDark))),
            ],
            const SizedBox(height: 6),
            ..._actions(),
          ],
        ),
      ),
    );
  }
}

/// A request for money or for stock: raised at a desk, decided by the
/// manager, paid out by the cashier.
class _RequestCard extends StatefulWidget {
  const _RequestCard(this.request, {required this.desk, required this.done});
  final Map<String, dynamic> request;
  final String desk;
  final Future<void> Function() done;

  @override
  State<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<_RequestCard> {
  bool _busy = false;

  Future<void> _send(String step, Map<String, dynamic> body) async {
    setState(() => _busy = true);
    try {
      await _apiPost('/api/expenses/${_int(widget.request['id'])}/$step', body);
      await widget.done();
    } on _ApiError catch (e) {
      if (mounted) _toast(context, e.message, bad: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    final body = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaySheet(widget.request),
    );
    if (body != null) await _send('pay', body);
  }

  Future<void> _decline() async {
    final why = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ReasonSheet(),
    );
    if (why != null) await _send('decide', {'approve': false, 'note': why});
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.request;
    final status = '${e['status']}';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Expanded(
                child: Text('${e['details']}',
                    style: _txt(14.5, weight: FontWeight.w700))),
            const SizedBox(width: 10),
            Text(_ugx(_int(e['amount'])), style: _title(15)),
          ]),
          const SizedBox(height: 4),
          Text(
              '${e['ref']} · ${e['kind_label']} · ${e['raised_by'] ?? ''} · '
              '${_when(e['created_at']?.toString())}',
              style: _txt(12, color: _mid)),
          if (_paymentLine(e).isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(_paymentLine(e),
                style: _txt(12.5, weight: FontWeight.w600, color: _inkSoft)),
          ],
          if ('${e['decision_note'] ?? ''}'.isNotEmpty)
            Text('“${e['decision_note']}”', style: _txt(12, color: _mid)),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: _Chip('${e['status_label']}',
                bg: status == 'declined'
                    ? _emberPale
                    : status == 'paid'
                        ? _greenPale
                        : _amberPale,
                fg: status == 'declined'
                    ? _ember
                    : status == 'paid'
                        ? _green
                        : _amber),
          ),
          if (widget.desk == 'manager' && status == 'raised') ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: _BigButton('Decline', _decline,
                      busy: _busy, tint: _ember, soft: true)),
              const SizedBox(width: 10),
              Expanded(
                  child: _BigButton(
                      'Approve', () => _send('decide', {'approve': true}),
                      busy: _busy, tint: _green)),
            ]),
          ],
          if (widget.desk == 'cashier' && status == 'approved') ...[
            const SizedBox(height: 12),
            _BigButton('Pay out', _pay, busy: _busy),
          ],
        ],
      ),
    );
  }
}

/// "MTN Mobile Money to Kayizzi Badru, 0772 123 456, ID 1234"
String _paymentLine(Map<String, dynamic> e) {
  final how = _method(e['method']);
  final who = '${e['payee'] ?? ''}';
  return [
    if (how.isNotEmpty && who.isNotEmpty)
      '$how to $who'
    else if (how.isNotEmpty || who.isNotEmpty)
      how.isNotEmpty ? how : 'To $who',
    if ('${e['pay_number'] ?? ''}'.isNotEmpty) '${e['pay_number']}',
    if ('${e['pay_ref'] ?? ''}'.isNotEmpty) 'ID ${e['pay_ref']}',
  ].join(', ');
}

/// What the form holds about a payment, shared by adding and paying out.
class _Payment {
  String method = 'cash';
  final payee = TextEditingController();
  final number = TextEditingController();
  final ref = TextEditingController();

  bool get hasNumber =>
      const ['mtn_momo', 'airtel_money', 'bank'].contains(method);
  bool get hasRef => method != 'cash';
  bool get proofMissing => hasRef && ref.text.trim().length < 3;

  /// Only what the chosen method has: a number typed before switching to
  /// cash is not sent.
  Map<String, dynamic> get body => {
        'method': method,
        'payee': payee.text.trim(),
        'payNumber': hasNumber ? number.text.trim() : '',
        'payRef': hasRef ? ref.text.trim() : '',
      };

  void dispose() {
    payee.dispose();
    number.dispose();
    ref.dispose();
  }
}

class _PaymentFields extends StatelessWidget {
  const _PaymentFields(this.p, {required this.paid, required this.changed});
  final _Payment p;

  /// Money has gone, so the proof is asked for as well.
  final bool paid;
  final VoidCallback changed;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Payment method',
              style: _txt(13, weight: FontWeight.w600, color: _inkSoft)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in const [
              'cash',
              'mtn_momo',
              'airtel_money',
              'bank',
              'cheque',
              'card',
            ])
              _Pressable(
                scale: 0.96,
                onTap: () {
                  p.method = m;
                  changed();
                },
                child: Container(
                  constraints: const BoxConstraints(minHeight: 40),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: p.method == m ? _lime : _tile,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: p.method == m ? _brand : _hairline),
                  ),
                  child: Text(_method(m),
                      style: _txt(13,
                          weight: FontWeight.w600,
                          color: p.method == m ? _onLime : _inkSoft)),
                ),
              ),
          ]),
          const SizedBox(height: 12),
          _Field(
            controller: p.payee,
            hint: 'Who is being paid? Their name',
            capitalisation: TextCapitalization.words,
            onChanged: (_) => changed(),
          ),
          if (p.hasNumber) ...[
            const SizedBox(height: 10),
            _Field(
              key: ValueKey('number ${p.method}'),
              controller: p.number,
              hint: p.method == 'bank'
                  ? 'Bank and account number'
                  : 'Their ${_method(p.method)} number',
              keyboardType: p.method == 'bank'
                  ? TextInputType.text
                  : TextInputType.phone,
              onChanged: (_) => changed(),
            ),
          ],
          if (paid && p.hasRef) ...[
            const SizedBox(height: 10),
            _Field(
              controller: p.ref,
              hint: p.method == 'cheque' ? 'Cheque number' : 'Transaction ID',
              capitalisation: TextCapitalization.characters,
              onChanged: (_) => changed(),
            ),
          ],
        ],
      );
}

/// Paying out an approved expense. Pops what to send.
class _PaySheet extends StatefulWidget {
  const _PaySheet(this.request);
  final Map<String, dynamic> request;

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  final _p = _Payment();

  @override
  void initState() {
    super.initState();
    final e = widget.request;
    final m = '${e['method'] ?? ''}';
    if (const ['mtn_momo', 'airtel_money', 'bank', 'cheque', 'card']
        .contains(m)) {
      _p.method = m;
    }
    _p.payee.text = '${e['payee'] ?? ''}';
    _p.number.text = '${e['pay_number'] ?? ''}';
  }

  @override
  void dispose() {
    _p.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _Sheet(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Pay out ${widget.request['ref']}', style: _title(20)),
              const SizedBox(height: 4),
              Text('${widget.request['details']}',
                  style: _txt(13.5, color: _mid)),
              const SizedBox(height: 16),
              _PaymentFields(_p, paid: true, changed: () => setState(() {})),
              const SizedBox(height: 16),
              _BigButton(
                'Pay ${_ugx(_int(widget.request['amount']))}',
                _p.proofMissing
                    ? null
                    : () => Navigator.of(context).pop(_p.body),
                tint: _green,
              ),
            ],
          ),
        ),
      );
}

class _ReasonSheet extends StatefulWidget {
  const _ReasonSheet();

  @override
  State<_ReasonSheet> createState() => _ReasonSheetState();
}

class _ReasonSheetState extends State<_ReasonSheet> {
  final _why = TextEditingController();

  @override
  void dispose() {
    _why.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _Sheet(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Why is it declined?', style: _title(20)),
              const SizedBox(height: 12),
              _Field(
                controller: _why,
                hint: 'Whoever asked will read this',
                autofocus: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              _BigButton(
                'Decline',
                _why.text.trim().length >= 3
                    ? () => Navigator.of(context).pop(_why.text.trim())
                    : null,
                tint: _ember,
              ),
            ],
          ),
        ),
      );
}

class _RequestSheet extends StatefulWidget {
  const _RequestSheet();

  @override
  State<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<_RequestSheet> {
  final _details = TextEditingController();
  final _amount = TextEditingController();
  late String _kind = _Session().role == 'store' ? 'stock_use' : 'expense';
  // The manager is the approval, so theirs is recorded as it is saved.
  final bool _boss = _Session().role == 'manager';
  bool _paid = true;
  final _p = _Payment();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _p.dispose();
    _details.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost('/api/expenses', {
        'kind': _kind,
        'details': _details.text.trim(),
        'amount': _int(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')),
        ..._p.body,
        if (_boss) 'settle': _paid ? 'paid' : 'approve',
      });
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ok = _details.text.trim().length >= 3 &&
        _int(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) > 0 &&
        !(_boss && _paid && _p.proofMissing);
    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Add expense', style: _title(20)),
            const SizedBox(height: 4),
            Text(
                _boss
                    ? 'It is approved as you save it.'
                    : 'The manager approves it before anything is paid.',
                style: _txt(13, color: _mid)),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (k, label) in const [
                ('expense', 'Shop expense'),
                ('stock_use', 'Items for the shop'),
                ('float', 'Till float'),
                ('advance', 'Advance'),
              ])
                _Pressable(
                  scale: 0.96,
                  onTap: () => setState(() => _kind = k),
                  child: _Chip(label,
                      bg: _kind == k ? _lime : _tile,
                      fg: _kind == k ? _onLime : _inkSoft),
                ),
            ]),
            const SizedBox(height: 12),
            _Field(
              controller: _details,
              hint: 'What is it for?',
              capitalisation: TextCapitalization.sentences,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            _Field(
              controller: _amount,
              hint: 'Amount in UGX',
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
            ),
            if (_boss) ...[
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final (paid, label) in const [
                  (true, 'Already paid'),
                  (false, 'Cashier to pay'),
                ])
                  _Pressable(
                    scale: 0.96,
                    onTap: () => setState(() => _paid = paid),
                    child: _Chip(label,
                        bg: _paid == paid ? _lime : _tile,
                        fg: _paid == paid ? _onLime : _inkSoft),
                  ),
              ]),
            ],
            const SizedBox(height: 14),
            _PaymentFields(_p,
                paid: _boss && _paid, changed: () => setState(() {})),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember)),
            ],
            const SizedBox(height: 14),
            _BigButton(_boss ? 'Add expense' : 'Send to the manager',
                ok ? _submit : null,
                busy: _busy),
          ],
        ),
      ),
    );
  }
}

/// The manager's stock: what is on the shelf, what it is worth, what
/// needs ordering, and a sheet to receive, count or write off.
class _StockTab extends StatefulWidget {
  const _StockTab({required this.onExpired});
  final Future<void> Function() onExpired;

  @override
  State<_StockTab> createState() => _StockTabState();
}

class _StockTabState extends State<_StockTab> {
  Map<String, dynamic>? _data;
  String? _error;
  String _show = 'all';
  String _sort = 'name';
  String? _cat;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/products');
      if (!mounted) return;
      setState(() {
        _data = r;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await widget.onExpired();
        return;
      }
      setState(() => _error = e.message);
    }
  }

  Future<void> _open(Widget sheet) async {
    final done = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => sheet,
    );
    if (done != null) {
      await _load();
      if (mounted) _toast(context, done);
    }
  }

  List<String> get _suppliers => ((_data?['suppliers'] as List?) ?? const [])
      .map((x) => '$x')
      .toList();

  /// Which filter a product falls under.
  bool _in(Map<String, dynamic> p, String k) => switch (k) {
        'low' => '${p['state']}' == 'low' || '${p['state']}' == 'out',
        'out' => '${p['state']}' == 'out',
        'noprice' => _int(p['price']) <= 0,
        'nocost' => _int(p['cost']) <= 0,
        'selling' => _num(p['sold_30']) > 0,
        _ => true,
      };

  @override
  Widget build(BuildContext context) {
    final all = ((_data?['products'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .where((p) => _int(p['active']) == 1 || p['active'] == true)
        .toList();
    final q = _search.text.trim().toLowerCase();
    final cats = {
      for (final p in all)
        if ('${p['category_name'] ?? ''}'.isNotEmpty) '${p['category_name']}'
    }.toList()
      ..sort();
    final rows = all.where((p) {
      if (!_in(p, _show)) return false;
      if (_cat != null && '${p['category_name']}' != _cat) return false;
      if (q.isEmpty) return true;
      return '${p['name']} ${p['code']} ${p['category_name'] ?? ''} ${p['supplier'] ?? ''}'
          .toLowerCase()
          .contains(q);
    }).toList()
      ..sort((a, b) => switch (_sort) {
            'most' => _num(b['stock_available']).compareTo(_num(a['stock_available'])),
            'value' => _int(b['stock_value']).compareTo(_int(a['stock_value'])),
            'least' => _num(a['stock_available']).compareTo(_num(b['stock_available'])),
            'selling' => _num(b['sold_30']).compareTo(_num(a['sold_30'])),
            _ => '${a['name']}'.toLowerCase().compareTo('${b['name']}'.toLowerCase()),
          });
    final s = (_data?['summary'] as Map?)?.cast<String, dynamic>();
    final count = {
      for (final k in ['all', 'low', 'out', 'noprice', 'nocost', 'selling'])
        k: all.where((p) => _in(p, k)).length,
    };
    final shownValue = rows.fold<int>(0, (n, p) => n + _int(p['stock_value']));

    Widget mini(String label, String value) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: _txt(11, color: _onLime.withOpacity(0.75))),
              const SizedBox(height: 2),
              Text(value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _title(14.5, weight: FontWeight.w800, color: _onLime)),
            ],
          ),
        );

    return Column(
      children: [
        _Header(
          subtitle: '${_deskName(_Session().role)} · ${_Session().fullName}',
          trailing: _Pressable(
            scale: 0.9,
            onTap: () => _open(_ProductSheet(suppliers: _suppliers)),
            child: Container(
              width: 38,
              height: 38,
              decoration: _liquid(circle: true, onDark: true),
              child: const Icon(Icons.add_rounded, size: 21, color: _onLime),
            ),
          ),
        ),
        Expanded(
          child: _data == null && _error != null
              ? _Empty(
                  icon: Icons.cloud_off_rounded,
                  tone: _ember,
                  title: 'This could not be loaded',
                  line: _error!,
                  action: 'Try again',
                  onAction: _load,
                )
              : _data == null
                  ? const Center(
                      child: CircularProgressIndicator(color: _brand))
                  : RefreshIndicator(
                      color: _brand,
                      onRefresh: _load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(12, 14, 12, 20),
                        children: [
                          Row(children: [
                            Text('Stock',
                                style: _title(20, weight: FontWeight.w800)),
                            const Spacer(),
                            Text('${all.length} items',
                                style: _txt(12.5, color: _mid)),
                          ]),
                          const SizedBox(height: 10),

                          // The money in the shop.
                          Container(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                            decoration: BoxDecoration(
                              color: _lime,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Stock value at buy price',
                                    style: _txt(12,
                                        weight: FontWeight.w600,
                                        color: _onLime.withOpacity(0.85))),
                                const SizedBox(height: 2),
                                Text(_ugx(_int(s?['stockValue'])),
                                    style: _title(24,
                                        weight: FontWeight.w800,
                                        color: _onLime)),
                                const SizedBox(height: 12),
                                Container(
                                  height: 1,
                                  color: _onLime.withOpacity(0.15),
                                ),
                                const SizedBox(height: 10),
                                Row(children: [
                                  mini('Sells for',
                                      _shortUgx(_int(s?['retailValue']))),
                                  mini('Profit on shelf',
                                      _shortUgx(_int(s?['profitInStock']))),
                                  mini('Buy again', '${count['low']}'),
                                ]),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Search and sort.
                          Row(children: [
                            Expanded(
                              child: _Field(
                                controller: _search,
                                hint: 'Search name, code, supplier',
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                            const SizedBox(width: 8),
                            PopupMenuButton<String>(
                              initialValue: _sort,
                              onSelected: (v) => setState(() => _sort = v),
                              color: _white,
                              itemBuilder: (_) => [
                                for (final (k, label) in const [
                                  ('name', 'A to Z'),
                                  ('least', 'Least left first'),
                                  ('most', 'Most left first'),
                                  ('value', 'Most value first'),
                                  ('selling', 'Best selling first'),
                                ])
                                  PopupMenuItem(
                                    value: k,
                                    child: Text(label,
                                        style: _txt(13.5,
                                            weight: _sort == k
                                                ? FontWeight.w700
                                                : FontWeight.w400,
                                            color: _ink)),
                                  ),
                              ],
                              child: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: _tile,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: _hairline),
                                ),
                                child: const Icon(Icons.sort_rounded,
                                    size: 20, color: _inkSoft),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 10),

                          // Filters, each with its count.
                          SizedBox(
                            height: 34,
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              children: [
                                for (final (k, label, tone) in [
                                  ('all', 'All', _lime),
                                  ('low', 'Buy again', _amber),
                                  ('out', 'Out', _ember),
                                  ('noprice', 'No price', _blue),
                                  ('nocost', 'No buy price', _blue),
                                  ('selling', 'Selling', _green),
                                ])
                                  Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: _Pressable(
                                      scale: 0.95,
                                      onTap: () => setState(() => _show = k),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: _show == k ? tone : _white,
                                          borderRadius:
                                              BorderRadius.circular(17),
                                          border: Border.all(
                                              color: _show == k
                                                  ? tone
                                                  : _hairline),
                                        ),
                                        child: Text('$label  ${count[k]}',
                                            style: _txt(12.5,
                                                weight: FontWeight.w700,
                                                color: _show == k
                                                    ? (tone == _lime
                                                        ? _onLime
                                                        : _white)
                                                    : _inkSoft)),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (cats.length > 1) ...[
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 30,
                              child: ListView(
                                scrollDirection: Axis.horizontal,
                                children: [
                                  for (final c in [null, ...cats])
                                    Padding(
                                      padding: const EdgeInsets.only(right: 6),
                                      child: _Pressable(
                                        scale: 0.95,
                                        onTap: () => setState(() => _cat = c),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 11),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: _cat == c
                                                ? _brandPale
                                                : _tile,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                            border: Border.all(
                                                color: _cat == c
                                                    ? _brand
                                                    : _hairline),
                                          ),
                                          child: Text(c ?? 'Every category',
                                              style: _txt(12,
                                                  weight: FontWeight.w600,
                                                  color: _cat == c
                                                      ? _brandDark
                                                      : _mid)),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Text(
                              '${rows.length} shown · worth ${_ugx(shownValue)}',
                              style: _txt(12, color: _mid)),
                          const SizedBox(height: 8),
                          if (_error != null) ...[
                            Text('Not up to date: $_error',
                                style: _txt(12.5, color: _ember)),
                            const SizedBox(height: 10),
                          ],
                          if (rows.isEmpty)
                            const _Empty(
                              icon: Icons.inventory_2_outlined,
                              title: 'Nothing here',
                              line: 'Try another search or filter.',
                            ),
                          for (final p in rows)
                            _Pressable(
                              scale: 0.98,
                              onTap: () => _open(
                                  _MoveSheet(p, suppliers: _suppliers)),
                              child: _StockRow(p),
                            ),
                        ],
                      ),
                    ),
        ),
      ],
    );
  }
}

(Color, Color) _stockColours(String state) => switch (state) {
      'out' => (_emberPale, _ember),
      'low' => (_amberPale, _amber),
      'ok' => (_greenPale, _green),
      _ => (_tile, _mid),
    };

/// One product in the stock list: how many, how it sells, what it is
/// worth, and where it came from.
class _StockRow extends StatelessWidget {
  const _StockRow(this.p);
  final Map<String, dynamic> p;

  @override
  Widget build(BuildContext context) {
    final state = '${p['state']}';
    final (bg, fg) = _stockColours(state);
    final unit = '${p['unit'] ?? ''}';
    final left = _num(p['stock_available']);
    final level = _num(p['reorder_level']);
    // Full at twice the reorder level, or at what is there if no level.
    final full = level > 0 ? level * 2 : (left > 0 ? left : 1);
    final fill = (left / full).clamp(0.0, 1.0);
    final price = _int(p['price']);
    final cost = _int(p['cost']);
    final days = p['days_left'];
    final last = (p['last_buy'] as Map?)?.cast<String, dynamic>();

    Widget fact(String k, String v, {Color color = _ink}) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(k, style: _txt(10.5, color: _light)),
              const SizedBox(height: 1),
              Text(v,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(12, weight: FontWeight.w700, color: color)),
            ],
          ),
        );

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${p['name']}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: _txt(13.5, weight: FontWeight.w700, color: _ink)),
                    const SizedBox(height: 2),
                    Text(
                        [p['code'], p['category_name']]
                            .where((x) => x != null && '$x'.isNotEmpty)
                            .join(' · '),
                        style: _txt(11.5, color: _mid)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${_qtyText(left)} $unit',
                      style: _title(16, weight: FontWeight.w800, color: fg)),
                  const SizedBox(height: 3),
                  _Chip('${p['status_label']}', bg: bg, fg: fg),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          // How full the shelf is.
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: fill,
              minHeight: 5,
              backgroundColor: _hairline,
              color: fg,
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            fact('Sells at', price > 0 ? _shortUgx(price) : 'No price',
                color: price > 0 ? _ink : _blue),
            fact('Buys at', cost > 0 ? _shortUgx(cost) : 'Not set',
                color: cost > 0 ? _ink : _blue),
            fact('Margin', p['margin'] != null ? '${p['margin']}%' : '-',
                color: (_num(p['margin']) < 0) ? _ember : _green),
            fact('Worth', _shortUgx(_int(p['stock_value']))),
          ]),
          if (last != null || days != null || _num(p['sold_30']) > 0) ...[
            const SizedBox(height: 7),
            Text(
                [
                  if (_num(p['sold_30']) > 0)
                    'Sold ${_qtyText(_num(p['sold_30']))} in 30 days',
                  if (days != null) '${_int(days)} days left',
                  if (last != null && '${last['supplier']}'.isNotEmpty)
                    'from ${last['supplier']}',
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _txt(11.5, color: _mid)),
          ],
        ],
      ),
    );
  }
}

/// One product: its figures, and stock in or out. Pops a message.
class _MoveSheet extends StatefulWidget {
  const _MoveSheet(this.p, {required this.suppliers});
  final Map<String, dynamic> p;
  final List<String> suppliers;

  @override
  State<_MoveSheet> createState() => _MoveSheetState();
}

class _MoveSheetState extends State<_MoveSheet> {
  String _kind = 'count';
  final _qty = TextEditingController();
  late final _cost = TextEditingController(
      text: _int(widget.p['cost']) > 0 ? '${_int(widget.p['cost'])}' : '');
  final _note = TextEditingController();
  late final _supplier = TextEditingController(
      text: '${widget.p['supplier'] ?? ''}');
  final _fdn = TextEditingController();
  DateTime _day = DateTime.now();
  bool _busy = false;
  String? _error;

  // Counting the shelf is a stock-take on the web panel, where the
  // manager approves it before the book changes.
  static const _kinds = [
    ('count', 'Count it', 0),
    ('received', 'Goods arrived', 1),
    ('damaged', 'Damaged or lost', -1),
    ('own_use', 'Used by the shop', -1),
    ('returned', 'Customer return', 1),
    ('correction', 'Correction', 0),
  ];

  @override
  void dispose() {
    _qty.dispose();
    _cost.dispose();
    _note.dispose();
    _supplier.dispose();
    _fdn.dispose();
    super.dispose();
  }

  String get _dayText =>
      '${_day.year}-${_day.month.toString().padLeft(2, '0')}-${_day.day.toString().padLeft(2, '0')}';

  /// A purchase only counts with its paperwork.
  bool get _paperwork =>
      _kind != 'received' ||
      (_supplier.text.trim().isNotEmpty &&
          _fdn.text.trim().isNotEmpty &&
          _int(_cost.text.replaceAll(RegExp(r'[^0-9]'), '')) > 0);

  double get _now => _num(widget.p['stock_available']);
  double get _n => double.tryParse(_qty.text.trim()) ?? 0;
  double get _after {
    final sign = _kinds.firstWhere((k) => k.$1 == _kind).$3;
    if (_kind == 'count') return _n;
    if (_kind == 'correction') return _now + _n;
    return _now + sign * _n;
  }

  bool get _needsNote => const ['damaged', 'own_use', 'correction'].contains(_kind);

  bool get _ok =>
      !_busy &&
      _paperwork &&
      _qty.text.trim().isNotEmpty &&
      _after >= 0 &&
      (_kind == 'count'
          ? _n >= 0
          : _kind == 'correction'
              ? _n != 0
              : _n > 0) &&
      (!_needsNote || _note.text.trim().length >= 3);

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost('/api/manager/products/${_int(widget.p['id'])}/stock', {
        'kind': _kind,
        'qty': _n,
        'note': _note.text.trim(),
        'date': _dayText,
        if (_kind == 'received') ...{
          'unitCost': _int(_cost.text.replaceAll(RegExp(r'[^0-9]'), '')),
          'supplier': _supplier.text.trim(),
          'ref': _fdn.text.trim(),
        },
      });
      HapticFeedback.mediumImpact();
      navigator.pop('${widget.p['name']}: ${_qtyText(_after)} ${widget.p['unit']} in stock');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.p;
    final unit = '${p['unit'] ?? ''}';
    final facts = [
      ('In stock', p['tracked'] == true ? '${_qtyText(_now)} $unit' : 'Not counted'),
      ('Sale price', _ugx(_int(p['price']))),
      ('Buy price', _int(p['cost']) > 0 ? _ugx(_int(p['cost'])) : 'Not set'),
      if (p['margin'] != null) ('Margin', '${p['margin']}%'),
      if (_int(p['reorder_level']) > 0)
        ('Reorder at', '${_int(p['reorder_level'])} $unit'),
      if (_int(p['sold_30']) > 0) ('Sold, 30 days', '${_int(p['sold_30'])} $unit'),
    ];
    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Expanded(child: Text('${p['name']}', style: _title(20))),
              TextButton(
                onPressed: () async {
                  final navigator = Navigator.of(context);
                  final done = await showModalBottomSheet<String>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) =>
                        _ProductSheet(product: p, suppliers: widget.suppliers),
                  );
                  if (done != null) navigator.pop(done);
                },
                child: Text('Edit',
                    style: _txt(14, weight: FontWeight.w700, color: _brandDark)),
              ),
            ]),
            Text('${p['code']}', style: _txt(12.5, color: _mid)),
            const SizedBox(height: 14),
            Wrap(spacing: 18, runSpacing: 10, children: [
              for (final (k, v) in facts)
                SizedBox(
                  width: 140,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(k, style: _txt(12, color: _mid)),
                      Text(v, style: _txt(14, weight: FontWeight.w700, color: _ink)),
                    ],
                  ),
                ),
            ]),
            const SizedBox(height: 18),
            Text('What happened?',
                style: _txt(13, weight: FontWeight.w600, color: _inkSoft)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (k, label, _) in _kinds)
                _Pressable(
                  scale: 0.96,
                  onTap: () => setState(() {
                    _kind = k;
                    _error = null;
                  }),
                  child: _Chip(label,
                      bg: _kind == k ? _lime : _tile,
                      fg: _kind == k ? _onLime : _inkSoft),
                ),
            ]),
            const SizedBox(height: 14),
            _Field(
              controller: _qty,
              hint: _kind == 'count'
                  ? 'How many $unit are on the shelf?'
                  : _kind == 'correction'
                      ? '$unit to add, or minus to take off'
                      : 'How many $unit?',
              keyboardType: const TextInputType.numberWithOptions(signed: true),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            _Pressable(
              scale: 0.98,
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _day,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _day = picked);
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: _tile,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _hairline),
                ),
                child: Row(children: [
                  Text(_kind == 'received' ? 'Delivery date' : 'Date',
                      style: _txt(14, color: _mid)),
                  const Spacer(),
                  Text(_dayText,
                      style: _txt(14.5, weight: FontWeight.w600, color: _ink)),
                  const SizedBox(width: 8),
                  const Icon(Icons.calendar_today_rounded,
                      size: 16, color: _mid),
                ]),
              ),
            ),
            if (_kind == 'received') ...[
              const SizedBox(height: 10),
              _Field(
                controller: _cost,
                hint: 'Buy price for one (UGX)',
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              _Field(
                controller: _supplier,
                hint: 'Supplier',
                capitalisation: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              _Field(
                controller: _fdn,
                hint: 'Delivery note (FDN) number',
                capitalisation: TextCapitalization.characters,
                onChanged: (_) => setState(() {}),
              ),
            ],
            const SizedBox(height: 10),
            _Field(
              controller: _note,
              hint: _needsNote ? 'What happened? (needed)' : 'Note (optional)',
              capitalisation: TextCapitalization.sentences,
              onChanged: (_) => setState(() {}),
            ),
            if (_qty.text.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: _after < 0 ? _emberPale : _tile,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(children: [
                  Text('Stock after this', style: _txt(13, color: _mid)),
                  const Spacer(),
                  Text(
                      _after < 0
                          ? 'Cannot go below zero'
                          : '${_qtyText(_now)} → ${_qtyText(_after)} $unit',
                      style: _title(15, color: _after < 0 ? _ember : _ink)),
                ]),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 14),
            _BigButton('Save to the stock book', _ok ? _save : null,
                busy: _busy),
          ],
        ),
      ),
    );
  }
}

/// Adding a product, or editing one. Pops a message.
class _ProductSheet extends StatefulWidget {
  const _ProductSheet({this.product, required this.suppliers});
  final Map<String, dynamic>? product;
  final List<String> suppliers;

  @override
  State<_ProductSheet> createState() => _ProductSheetState();
}

class _ProductSheetState extends State<_ProductSheet> {
  late final Map<String, dynamic>? _p = widget.product;
  late final _name = TextEditingController(text: '${_p?['name'] ?? ''}');
  late final _code = TextEditingController(text: '${_p?['code'] ?? ''}');
  late final _unit = TextEditingController(text: '${_p?['unit'] ?? 'pc'}');
  late final _price = TextEditingController(
      text: _p == null ? '' : '${_int(_p!['price'])}');
  late final _cost = TextEditingController(
      text: _int(_p?['cost']) > 0 ? '${_int(_p!['cost'])}' : '');
  final _stock = TextEditingController();
  late final _reorder = TextEditingController(
      text: _int(_p?['reorder_level']) > 0 ? '${_int(_p!['reorder_level'])}' : '');
  late final _orderQty = TextEditingController(
      text: _int(_p?['reorder_qty']) > 0 ? '${_int(_p!['reorder_qty'])}' : '');
  late final _category =
      TextEditingController(text: '${_p?['category_name'] ?? ''}');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _name, _code, _unit, _price, _cost, _stock, _reorder, _orderQty, _category
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  int _num(TextEditingController c) =>
      _int(c.text.replaceAll(RegExp(r'[^0-9]'), ''));

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(
          _p == null
              ? '/api/manager/products'
              : '/api/manager/products/${_int(_p!['id'])}',
          {
            'name': _name.text.trim(),
            'code': _code.text.trim(),
            'unit': _unit.text.trim(),
            'category': _category.text.trim(),
            'price': _num(_price),
            'cost': _num(_cost),
            'reorderLevel': _num(_reorder),
            'reorderQty': _num(_orderQty),
            if (_p == null) 'stockAvailable': _num(_stock),
          });
      HapticFeedback.mediumImpact();
      navigator.pop(_p == null
          ? '${_name.text.trim()} added'
          : '${_name.text.trim()} saved');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  /// Asked first, because it takes the product out of the app.
  Future<void> _delete() async {
    final navigator = Navigator.of(context);
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Delete ${_p!['name']}?', style: _title(18)),
        content: Text(
            'It comes off sale and out of the app. Past orders keep its name '
            'and price. To sell it again later, retire it on the web panel instead.',
            style: _txt(14, height: 1.45)),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: Text('Keep it', style: _txt(14, weight: FontWeight.w600))),
          TextButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: Text('Delete',
                  style: _txt(14, weight: FontWeight.w700, color: _ember))),
        ],
      ),
    );
    if (sure != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _apiPost('/api/manager/products/delete', {
        'ids': [_int(_p!['id'])],
      });
      HapticFeedback.mediumImpact();
      navigator.pop('${_p!['name']} deleted');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final price = _num(_price), cost = _num(_cost);
    final ok = !_busy && _name.text.trim().length >= 2 && price > 0;
    Widget pair(Widget a, Widget b) => Row(children: [
          Expanded(child: a),
          const SizedBox(width: 10),
          Expanded(child: b),
        ]);
    Widget label(String t) => Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 6),
          child: Text(t,
              style: _txt(12.5, weight: FontWeight.w700, color: _mid)),
        );
    final changed = (String _) => setState(() {});

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_p == null ? 'Add a product' : 'Edit product',
                style: _title(20)),
            label('NAME'),
            _Field(
                controller: _name,
                hint: 'Hima Cement 50kg',
                capitalisation: TextCapitalization.words,
                onChanged: changed),
            const SizedBox(height: 10),
            pair(
              _Field(controller: _code, hint: 'Code (made if empty)'),
              _Field(controller: _unit, hint: 'Sold by: bag, kg, pc'),
            ),
            const SizedBox(height: 10),
            _Field(
                controller: _category,
                hint: 'Category',
                capitalisation: TextCapitalization.words),
            label('PRICES (UGX)'),
            pair(
              _Field(
                  controller: _cost,
                  hint: 'Buy price',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
              _Field(
                  controller: _price,
                  hint: 'Sale price',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
            ),
            if (price > 0 && cost > 0) ...[
              const SizedBox(height: 8),
              Text(
                  price >= cost
                      ? 'Profit ${_ugx(price - cost)} each, '
                          '${((price - cost) / price * 100).toStringAsFixed(1)}% margin'
                      : 'Sold below cost',
                  style: _txt(12.5,
                      weight: FontWeight.w600,
                      color: price >= cost ? _green : _ember)),
            ],
            label('STOCK'),
            if (_p == null) ...[
              _Field(
                  controller: _stock,
                  hint: 'Opening stock: how many now',
                  keyboardType: TextInputType.number),
              const SizedBox(height: 10),
            ],
            pair(
              _Field(
                  controller: _reorder,
                  hint: 'Reorder level',
                  keyboardType: TextInputType.number),
              _Field(
                  controller: _orderQty,
                  hint: 'Order quantity',
                  keyboardType: TextInputType.number),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 16),
            _BigButton(_p == null ? 'Add product' : 'Save', ok ? _save : null,
                busy: _busy),
            if (_p != null)
              Center(
                child: TextButton(
                  onPressed: _busy ? null : _delete,
                  child: Text('Delete product',
                      style: _txt(14, weight: FontWeight.w600, color: _ember)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  MANAGER — WORKERS AND SALARIES
//
//  Everyone the shop pays, their advances, and the month's payroll.
//  Approved salaries become expenses for the cashier to pay out, so
//  they land in the cash book like any other money going out.
// ═══════════════════════════════════════════════════════════════

const _payMethods = [
  ('cash', 'Cash'),
  ('mtn_momo', 'MTN'),
  ('airtel_money', 'Airtel'),
  ('bank', 'Bank'),
];

String _monthName(String period) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ];
  final p = period.split('-');
  if (p.length != 2) return period;
  final m = int.tryParse(p[1]) ?? 1;
  return '${months[(m - 1).clamp(0, 11)]} ${p[0]}';
}

String _shiftMonth(String period, int by) {
  final p = period.split('-');
  var y = int.tryParse(p[0]) ?? DateTime.now().year;
  var m = (int.tryParse(p.length > 1 ? p[1] : '') ?? 1) + by;
  while (m < 1) {
    m += 12;
    y--;
  }
  while (m > 12) {
    m -= 12;
    y++;
  }
  return '$y-${m.toString().padLeft(2, '0')}';
}

String _thisMonth() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}';
}

/// A row of chips where exactly one is chosen.
Widget _pickOne(List<(String, String)> options, String value,
        ValueChanged<String> onPick) =>
    Wrap(spacing: 8, runSpacing: 8, children: [
      for (final (k, label) in options)
        _Pressable(
          scale: 0.96,
          onTap: () => onPick(k),
          child: _Chip(label,
              bg: value == k ? _lime : _tile,
              fg: value == k ? _onLime : _inkSoft),
        ),
    ]);

Widget _sheetLabel(String t) => Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 6),
      child: Text(t, style: _txt(12.5, weight: FontWeight.w700, color: _mid)),
    );

Widget _pair(Widget a, Widget b) => Row(children: [
      Expanded(child: a),
      const SizedBox(width: 10),
      Expanded(child: b),
    ]);

int _digits(TextEditingController c) =>
    _int(c.text.replaceAll(RegExp(r'[^0-9]'), ''));

class _WorkersTab extends StatefulWidget {
  const _WorkersTab({required this.onExpired});
  final Future<void> Function() onExpired;

  @override
  State<_WorkersTab> createState() => _WorkersTabState();
}

class _WorkersTabState extends State<_WorkersTab> {
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _pay;
  String? _error;
  String _view = 'workers';
  String _period = _thisMonth();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/workers');
      final p = await _apiGet('/api/manager/payroll?period=$_period');
      if (!mounted) return;
      setState(() {
        _data = r;
        _pay = p;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await widget.onExpired();
        return;
      }
      setState(() => _error = e.code == 'rest_no_route'
          ? 'Workers need the new plugin on the website (1.10.0).'
          : e.message);
    }
  }

  Future<void> _month(int by) async {
    setState(() {
      _period = _shiftMonth(_period, by);
      _pay = null;
    });
    await _load();
  }

  Future<void> _open(Widget sheet) async {
    final done = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => sheet,
    );
    if (done == null) return;
    // The worker sheet hands over to the advance sheet this way, so
    // the two never sit stacked on top of each other.
    if (done.startsWith('advance:')) {
      final id = _int(done.substring(8));
      final w = _workers.where((x) => _int(x['id']) == id).firstOrNull;
      if (w != null) await _open(_AdvanceSheet(w));
      return;
    }
    await _load();
    if (mounted) _toast(context, done);
  }

  List<Map<String, dynamic>> get _workers =>
      ((_data?['workers'] as List?) ?? const [])
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();

  Future<void> _draft() async {
    setState(() => _busy = true);
    try {
      final r = await _apiPost('/api/manager/payroll/start', {'period': _period});
      if (!mounted) return;
      setState(() {
        _pay = r;
        _busy = false;
      });
      _toast(context, '${_int(r['made'])} payslips drafted. Check them, then approve.');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(context, e.message, bad: true);
    }
  }

  Future<void> _approve(int count, int total) async {
    final how = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Approve ${_monthName(_period)}?', style: _title(18)),
        content: Text(
            '$count payslips, ${_ugx(total)} in all. Approved payslips can '
            'no longer be changed.\n\nThe cashier can pay them out from '
            'Expenses, or record that you paid them all in cash.',
            style: _txt(14, height: 1.45)),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(),
              child: Text('Not yet', style: _txt(14, weight: FontWeight.w600))),
          TextButton(
              onPressed: () => Navigator.of(c).pop('cash'),
              child: Text('I paid in cash',
                  style: _txt(14, weight: FontWeight.w600, color: _brandDark))),
          TextButton(
              onPressed: () => Navigator.of(c).pop('approve'),
              child: Text('Cashier pays',
                  style: _txt(14, weight: FontWeight.w700, color: _brand))),
        ],
      ),
    );
    if (how == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await _apiPost('/api/manager/payroll/approve',
          {'period': _period, 'settle': how});
      if (!mounted) return;
      setState(() {
        _pay = r;
        _busy = false;
      });
      await _load();
      if (!mounted) return;
      _toast(
          context,
          how == 'cash'
              ? 'Salaries booked as paid in cash.'
              : 'Salaries approved. They are in Expenses for the cashier.');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(context, e.message, bad: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = (_data?['summary'] as Map?)?.cast<String, dynamic>();
    final desks = ((_data?['desks'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();

    return Column(
      children: [
        _Header(
          subtitle: '${_deskName(_Session().role)} · ${_Session().fullName}',
          trailing: _Pressable(
            scale: 0.9,
            onTap: () => _open(_WorkerSheet(desks: desks)),
            child: Container(
              width: 38,
              height: 38,
              decoration: _liquid(circle: true, onDark: true),
              child: const Icon(Icons.person_add_alt_rounded,
                  size: 19, color: _onLime),
            ),
          ),
        ),
        Expanded(
          child: _data == null && _error != null
              ? _Empty(
                  icon: Icons.cloud_off_rounded,
                  tone: _ember,
                  title: 'This could not be loaded',
                  line: _error!,
                  action: 'Try again',
                  onAction: _load,
                )
              : _data == null
                  ? const Center(
                      child: CircularProgressIndicator(color: _brand))
                  : RefreshIndicator(
                      color: _brand,
                      onRefresh: _load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(12, 14, 12, 20),
                        children: [
                          Text('Workers & salaries',
                              style: _title(20, weight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              gradient: _heroGradient,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Monthly wage bill',
                                    style: _txt(12.5,
                                        weight: FontWeight.w600,
                                        color: _onLime.withOpacity(0.9))),
                                const SizedBox(height: 4),
                                Text(_ugx(_int(s?['wageBill'])),
                                    style: _title(26,
                                        weight: FontWeight.w800,
                                        color: _onLime)),
                                const SizedBox(height: 10),
                                Text(
                                    '${_int(s?['active'])} working'
                                    ' · ${_int(s?['advancesOwed']) == 0 ? 'no advances owed' : '${_shortUgx(_int(s?['advancesOwed']))} in advances owed'}',
                                    style: _txt(12.5,
                                        color: _onLime.withOpacity(0.92))),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          _pickOne(
                            const [
                              ('workers', 'Workers'),
                              ('payroll', 'Payroll'),
                            ],
                            _view,
                            (v) => setState(() => _view = v),
                          ),
                          const SizedBox(height: 14),
                          if (_error != null) ...[
                            Text('Not up to date: $_error',
                                style: _txt(12.5, color: _ember)),
                            const SizedBox(height: 10),
                          ],
                          if (_view == 'workers')
                            ..._workerList(desks)
                          else
                            ..._payroll(),
                        ],
                      ),
                    ),
        ),
      ],
    );
  }

  List<Widget> _workerList(List<Map<String, dynamic>> desks) {
    final all = _workers;
    if (all.isEmpty) {
      return [
        _Empty(
          icon: Icons.badge_outlined,
          title: 'Nobody on the payroll yet',
          line: 'Add everyone the shop pays: desk staff, loaders, the '
              'driver, the guard.',
          action: 'Add a worker',
          onAction: () => _open(_WorkerSheet(desks: desks)),
        ),
      ];
    }
    return [
      for (final w in all)
        _Pressable(
          scale: 0.98,
          onTap: () => _open(_WorkerSheet(worker: w, desks: desks)),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: _cardBox(),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${w['fullName']}',
                          style:
                              _txt(14, weight: FontWeight.w700, color: _ink)),
                      const SizedBox(height: 3),
                      Text(
                          [
                            w['job'] ?? 'Worker',
                            '${_ugx(_int(w['basePay']))} ${w['payBasis'] == 'daily' ? 'a day' : 'a month'}',
                            _method(w['payMethod']),
                          ].join(' · '),
                          style: _txt(12.5, color: _mid)),
                      if (_int(w['advanceOwed']) > 0) ...[
                        const SizedBox(height: 4),
                        Text('Owes ${_ugx(_int(w['advanceOwed']))} in advances',
                            style: _txt(12.5,
                                weight: FontWeight.w600, color: _amber)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                w['status'] == 'active'
                    ? const _Chip('Working', bg: _greenPale, fg: _green)
                    : const _Chip('Left', bg: _tile, fg: _mid),
              ],
            ),
          ),
        ),
    ];
  }

  List<Widget> _payroll() {
    final slips = ((_pay?['slips'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final missing = ((_pay?['missing'] as List?) ?? const []).length;
    final t = (_pay?['totals'] as Map?)?.cast<String, dynamic>();
    final drafts = slips.where((x) => x['status'] == 'draft').toList();
    final draftTotal = drafts.fold<int>(0, (n, x) => n + _int(x['net']));

    return [
      Row(
        children: [
          IconButton(
            onPressed: _busy ? null : () => _month(-1),
            icon: const Icon(Icons.chevron_left_rounded, color: _ink),
            tooltip: 'Month before',
          ),
          Expanded(
            child: Text(_monthName(_period),
                textAlign: TextAlign.center,
                style: _title(16, weight: FontWeight.w700)),
          ),
          IconButton(
            onPressed: _busy ? null : () => _month(1),
            icon: const Icon(Icons.chevron_right_rounded, color: _ink),
            tooltip: 'Month after',
          ),
        ],
      ),
      const SizedBox(height: 8),
      if (_pay == null)
        const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator(color: _brand)),
        )
      else ...[
        if (slips.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: _cardBox(),
            child: Row(
              children: [
                for (final (label, v) in [
                  ('Gross', _int(t?['gross'])),
                  ('Taken off', _int(t?['deductions']) + _int(t?['advances'])),
                  ('Net pay', _int(t?['net'])),
                ])
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: _txt(12, color: _mid)),
                        const SizedBox(height: 2),
                        Text(_shortUgx(v),
                            style: _title(15,
                                weight: FontWeight.w800,
                                color: label == 'Net pay' ? _brandDark : _ink)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        if (missing > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _BigButton(
                slips.isEmpty
                    ? 'Draft $missing payslips'
                    : 'Add $missing missing payslips',
                _draft,
                busy: _busy),
          ),
        if (drafts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _BigButton('Approve ${drafts.length} · ${_shortUgx(draftTotal)}',
                () => _approve(drafts.length, draftTotal),
                busy: _busy),
          ),
        if (slips.isEmpty && missing == 0)
          const _Empty(
            icon: Icons.payments_outlined,
            title: 'Nobody to pay',
            line: 'Add workers first. The payroll is drafted from them.',
          ),
        for (final x in slips)
          _Pressable(
            scale: 0.98,
            onTap: x['status'] == 'draft'
                ? () => _open(_SlipSheet(x,
                    owed: _int(_workers
                        .where((w) => _int(w['id']) == _int(x['workerId']))
                        .firstOrNull?['advanceOwed'])))
                : null,
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: _cardBox(),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${x['workerName']}',
                            style: _txt(14,
                                weight: FontWeight.w700, color: _ink)),
                        const SizedBox(height: 3),
                        Text(
                            [
                              if (x['payBasis'] == 'daily')
                                '${_int(x['daysWorked'])} days',
                              'gross ${_shortUgx(_int(x['gross']))}',
                              if (_int(x['deductions']) +
                                      _int(x['advanceRecovered']) >
                                  0)
                                'less ${_shortUgx(_int(x['deductions']) + _int(x['advanceRecovered']))}',
                            ].join(' · '),
                            style: _txt(12.5, color: _mid)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_ugx(_int(x['net'])),
                          style: _txt(14, weight: FontWeight.w800, color: _ink)),
                      const SizedBox(height: 4),
                      switch ('${x['status']}') {
                        'paid' => const _Chip('Paid', bg: _greenPale, fg: _green),
                        'approved' =>
                          const _Chip('With cashier', bg: _bluePale, fg: _blue),
                        _ => const _Chip('Draft', bg: _amberPale, fg: _amber),
                      },
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    ];
  }
}

class _WorkerSheet extends StatefulWidget {
  const _WorkerSheet({this.worker, required this.desks});
  final Map<String, dynamic>? worker;
  final List<Map<String, dynamic>> desks;

  @override
  State<_WorkerSheet> createState() => _WorkerSheetState();
}

class _WorkerSheetState extends State<_WorkerSheet> {
  late final Map<String, dynamic>? _w = widget.worker;
  late final _name = TextEditingController(text: '${_w?['fullName'] ?? ''}');
  late final _job = TextEditingController(text: '${_w?['job'] ?? ''}');
  late final _phone = TextEditingController(text: '${_w?['phone'] ?? ''}');
  late final _idNo = TextEditingController(text: '${_w?['idNumber'] ?? ''}');
  late final _pay = TextEditingController(
      text: _int(_w?['basePay']) > 0 ? '${_int(_w!['basePay'])}' : '');
  late final _allow = TextEditingController(
      text: _int(_w?['allowance']) > 0 ? '${_int(_w!['allowance'])}' : '');
  late final _number = TextEditingController(text: '${_w?['payNumber'] ?? ''}');
  late final _kin = TextEditingController(text: '${_w?['kinName'] ?? ''}');
  late final _kinPhone =
      TextEditingController(text: '${_w?['kinPhone'] ?? ''}');
  late String _basis = '${_w?['payBasis'] ?? 'monthly'}';
  late String _method = '${_w?['payMethod'] ?? 'cash'}';
  late String _status = '${_w?['status'] ?? 'active'}';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _name, _job, _phone, _idNo, _pay, _allow, _number, _kin, _kinPhone
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(
          _w == null
              ? '/api/manager/workers'
              : '/api/manager/workers/${_int(_w!['id'])}',
          {
            'fullName': _name.text.trim(),
            'job': _job.text.trim(),
            'phone': _phone.text.trim(),
            'idNumber': _idNo.text.trim(),
            'payBasis': _basis,
            'basePay': _digits(_pay),
            'allowance': _digits(_allow),
            'payMethod': _method,
            'payNumber': _method == 'cash' ? '' : _number.text.trim(),
            'kinName': _kin.text.trim(),
            'kinPhone': _kinPhone.text.trim(),
            'status': _status,
          });
      HapticFeedback.mediumImpact();
      navigator.pop(_w == null
          ? '${_name.text.trim()} added to the payroll'
          : '${_name.text.trim()} saved');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  Future<void> _delete() async {
    final navigator = Navigator.of(context);
    final owes = _int(_w!['advanceOwed']);
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Delete ${_w!['fullName']}?', style: _title(18)),
        content: Text(
            'They come off the payroll. Salaries and advances already paid '
            'stay in the books under their name.'
            '${owes > 0 ? '\n\nThey still owe ${_ugx(owes)}. Deleting writes it off.' : ''}'
            '\n\nIf they have simply left, mark them as Left instead.',
            style: _txt(14, height: 1.45)),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: Text('Keep them', style: _txt(14, weight: FontWeight.w600))),
          TextButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: Text('Delete',
                  style: _txt(14, weight: FontWeight.w700, color: _ember))),
        ],
      ),
    );
    if (sure != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _apiPost('/api/manager/workers/delete', {
        'ids': [_int(_w!['id'])],
      });
      HapticFeedback.mediumImpact();
      navigator.pop('${_w!['fullName']} deleted');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final daily = _basis == 'daily';
    final pay = _digits(_pay);
    final monthly = (daily ? pay * 26 : pay) + _digits(_allow);
    final ok = !_busy && _name.text.trim().length >= 2 && pay > 0;
    final changed = (String _) => setState(() {});

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_w == null ? 'Add a worker' : '${_w!['fullName']}',
                style: _title(20)),
            if (_w != null && _int(_w!['advanceOwed']) > 0) ...[
              const SizedBox(height: 4),
              Text('Owes ${_ugx(_int(_w!['advanceOwed']))} in advances',
                  style: _txt(13, weight: FontWeight.w600, color: _amber)),
            ],
            _sheetLabel('THE PERSON'),
            _Field(
                controller: _name,
                hint: 'Full name',
                capitalisation: TextCapitalization.words,
                onChanged: changed),
            const SizedBox(height: 10),
            _pair(
              _Field(
                  controller: _job,
                  hint: 'Job: loader, driver',
                  capitalisation: TextCapitalization.sentences),
              _Field(
                  controller: _phone,
                  hint: 'Phone',
                  keyboardType: TextInputType.phone),
            ),
            const SizedBox(height: 10),
            _Field(controller: _idNo, hint: 'National ID number'),
            _sheetLabel('PAY'),
            _pickOne(const [('monthly', 'Monthly salary'), ('daily', 'By the day')],
                _basis, (v) => setState(() => _basis = v)),
            const SizedBox(height: 10),
            _pair(
              _Field(
                  controller: _pay,
                  hint: daily ? 'Pay a day' : 'Monthly salary',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
              _Field(
                  controller: _allow,
                  hint: 'Allowance a month',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
            ),
            if (pay > 0) ...[
              const SizedBox(height: 8),
              Text(
                  'About ${_ugx(monthly)} a month${daily ? ' at 26 days' : ''}',
                  style: _txt(12.5, weight: FontWeight.w600, color: _green)),
            ],
            _sheetLabel('PAID BY'),
            _pickOne(_payMethods, _method, (v) => setState(() => _method = v)),
            if (_method != 'cash') ...[
              const SizedBox(height: 10),
              _Field(
                  controller: _number,
                  hint: _method == 'bank' ? 'Account number' : 'Mobile money number',
                  keyboardType: _method == 'bank'
                      ? TextInputType.text
                      : TextInputType.phone),
            ],
            _sheetLabel('NEXT OF KIN'),
            _pair(
              _Field(
                  controller: _kin,
                  hint: 'Name',
                  capitalisation: TextCapitalization.words),
              _Field(
                  controller: _kinPhone,
                  hint: 'Phone',
                  keyboardType: TextInputType.phone),
            ),
            if (_w != null) ...[
              _sheetLabel('STATUS'),
              _pickOne(const [('active', 'Working'), ('left', 'Has left')],
                  _status, (v) => setState(() => _status = v)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 16),
            _BigButton(_w == null ? 'Add worker' : 'Save', ok ? _save : null,
                busy: _busy),
            if (_w != null && _w!['status'] == 'active') ...[
              const SizedBox(height: 10),
              _Pressable(
                scale: 0.98,
                onTap: _busy
                    ? null
                    : () => Navigator.of(context)
                        .pop('advance:${_int(_w!['id'])}'),
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _tile,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: _hairline),
                  ),
                  child: Text('Give an advance',
                      style: _txt(14.5,
                          weight: FontWeight.w600, color: _inkSoft)),
                ),
              ),
            ],
            if (_w != null)
              Center(
                child: TextButton(
                  onPressed: _busy ? null : _delete,
                  child: Text('Delete worker',
                      style: _txt(14, weight: FontWeight.w600, color: _ember)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AdvanceSheet extends StatefulWidget {
  const _AdvanceSheet(this.worker);
  final Map<String, dynamic> worker;

  @override
  State<_AdvanceSheet> createState() => _AdvanceSheetState();
}

class _AdvanceSheetState extends State<_AdvanceSheet> {
  final _amount = TextEditingController();
  final _why = TextEditingController();
  final _ref = TextEditingController();
  late String _method = '${widget.worker['payMethod'] ?? 'cash'}';
  String _settle = 'paid';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_amount, _why, _ref]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _go() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost('/api/manager/workers/${_int(widget.worker['id'])}/advance', {
        'amount': _digits(_amount),
        'details': _why.text.trim(),
        'method': _method,
        'payRef': _ref.text.trim(),
        'settle': _settle,
      });
      HapticFeedback.mediumImpact();
      navigator.pop(_settle == 'paid'
          ? 'Advance booked. It comes off the next payslip.'
          : 'Advance sent to the cashier to pay out.');
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final needRef = _settle == 'paid' && _method != 'cash';
    final ok = !_busy &&
        _digits(_amount) > 0 &&
        (!needRef || _ref.text.trim().length >= 3);
    final changed = (String _) => setState(() {});
    final owes = _int(widget.worker['advanceOwed']);

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Advance to ${widget.worker['fullName']}', style: _title(20)),
            const SizedBox(height: 4),
            Text(
                owes > 0
                    ? 'Already owes ${_ugx(owes)}. This is added to it.'
                    : 'Taken back from the next payslips.',
                style: _txt(13, color: owes > 0 ? _amber : _mid)),
            _sheetLabel('HOW MUCH'),
            _pair(
              _Field(
                  controller: _amount,
                  hint: 'Amount (UGX)',
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  onChanged: changed),
              _Field(controller: _why, hint: 'What for'),
            ),
            _sheetLabel('THE MONEY'),
            _pickOne(const [('paid', 'I have given it'), ('approve', 'Cashier pays it')],
                _settle, (v) => setState(() => _settle = v)),
            const SizedBox(height: 10),
            _pickOne(_payMethods, _method, (v) => setState(() => _method = v)),
            if (needRef) ...[
              const SizedBox(height: 10),
              _Field(
                  controller: _ref,
                  hint: 'Transaction ID',
                  onChanged: changed),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 16),
            _BigButton(
                _settle == 'paid' ? 'Book the advance' : 'Send to the cashier',
                ok ? _go : null,
                busy: _busy),
          ],
        ),
      ),
    );
  }
}

class _SlipSheet extends StatefulWidget {
  const _SlipSheet(this.slip, {required this.owed});
  final Map<String, dynamic> slip;
  final int owed;

  @override
  State<_SlipSheet> createState() => _SlipSheetState();
}

class _SlipSheetState extends State<_SlipSheet> {
  late final Map<String, dynamic> _s = widget.slip;
  late final bool _daily = _s['payBasis'] == 'daily';
  late final _days = TextEditingController(text: '${_int(_s['daysWorked'])}');
  late final _base = TextEditingController(
      text: '${_int(_daily ? _s['rate'] : _s['basePay'])}');
  TextEditingController _c(String k) => TextEditingController(
      text: _int(_s[k]) > 0 ? '${_int(_s[k])}' : '');
  late final _allow = _c('allowance');
  late final _over = _c('overtime');
  late final _bonus = _c('bonus');
  late final _deduct = _c('deductions');
  late final _back = _c('advanceRecovered');
  late final _why =
      TextEditingController(text: '${_s['deductionNote'] ?? ''}');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_days, _base, _allow, _over, _bonus, _deduct, _back, _why]) {
      c.dispose();
    }
    super.dispose();
  }

  int get _gross =>
      (_daily ? _digits(_base) * _digits(_days) : _digits(_base)) +
      _digits(_allow) +
      _digits(_over) +
      _digits(_bonus);
  int get _net => _gross - _digits(_deduct) - _digits(_back);

  Future<void> _send(String path, Map<String, dynamic> body, String done) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(path, body);
      HapticFeedback.mediumImpact();
      navigator.pop(done);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final changed = (String _) => setState(() {});
    final id = _int(_s['id']);
    final net = _net;

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${_s['workerName']}', style: _title(20)),
            const SizedBox(height: 4),
            Text('Payslip for ${_s['month'] ?? _monthName('${_s['period']}')}',
                style: _txt(13, color: _mid)),
            _sheetLabel('PAY (UGX)'),
            if (_daily)
              _pair(
                _Field(
                    controller: _days,
                    hint: 'Days worked',
                    keyboardType: TextInputType.number,
                    onChanged: changed),
                _Field(
                    controller: _base,
                    hint: 'Pay a day',
                    keyboardType: TextInputType.number,
                    onChanged: changed),
              )
            else
              _Field(
                  controller: _base,
                  hint: 'Salary',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
            const SizedBox(height: 10),
            _pair(
              _Field(
                  controller: _allow,
                  hint: 'Allowance',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
              _Field(
                  controller: _over,
                  hint: 'Overtime',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
            ),
            const SizedBox(height: 10),
            _Field(
                controller: _bonus,
                hint: 'Bonus',
                keyboardType: TextInputType.number,
                onChanged: changed),
            _sheetLabel('TAKEN OFF (UGX)'),
            _pair(
              _Field(
                  controller: _deduct,
                  hint: 'Deductions',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
              _Field(
                  controller: _back,
                  hint: 'Advance back',
                  keyboardType: TextInputType.number,
                  onChanged: changed),
            ),
            const SizedBox(height: 10),
            _Field(controller: _why, hint: 'Why the deduction'),
            const SizedBox(height: 6),
            Text(
                widget.owed > 0
                    ? 'Owes ${_ugx(widget.owed)} in advances.'
                    : 'Owes nothing in advances.',
                style: _txt(12.5, color: _mid)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _tile,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Text('Net pay', style: _txt(13.5, color: _inkSoft)),
                  const Spacer(),
                  Text(_ugx(net),
                      style: _title(17,
                          weight: FontWeight.w800,
                          color: net < 0 ? _ember : _ink)),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 16),
            _BigButton(
                'Save payslip',
                net >= 0 && !_busy
                    ? () => _send(
                        '/api/manager/payroll/slips/$id',
                        {
                          'daysWorked': _digits(_days),
                          if (_daily) 'rate': _digits(_base) else 'basePay': _digits(_base),
                          'allowance': _digits(_allow),
                          'overtime': _digits(_over),
                          'bonus': _digits(_bonus),
                          'deductions': _digits(_deduct),
                          'advanceRecovered': _digits(_back),
                          'deductionNote': _why.text.trim(),
                        },
                        'Payslip saved: ${_ugx(net)}')
                    : null,
                busy: _busy),
            Center(
              child: TextButton(
                onPressed: _busy
                    ? null
                    : () => _send('/api/manager/payroll/slips/$id/delete', {},
                        '${_s['workerName']} taken off this payroll'),
                child: Text('Take off this payroll',
                    style: _txt(14, weight: FontWeight.w600, color: _ember)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The web pages Google Play asks every app to link to.
const String _panelBase = 'https://alhaheed-hardware.vercel.app';

/// The signed-in staff member: who they are, what their desk does, and
/// the shop's privacy policy.
class _AccountTab extends StatefulWidget {
  const _AccountTab({required this.onSignOut});
  final Future<void> Function() onSignOut;

  @override
  State<_AccountTab> createState() => _AccountTabState();
}

class _AccountTabState extends State<_AccountTab> {
  Map<String, dynamic>? _me;

  @override
  void initState() {
    super.initState();
    _apiGet('/api/auth/me').then((r) {
      if (mounted) {
        setState(() => _me = (r['user'] as Map?)?.cast<String, dynamic>());
      }
    }).catchError((_) {});
  }

  String _day(String? iso) {
    if (iso == null || iso.length < 10) return '';
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final mo = int.tryParse(iso.substring(5, 7)) ?? 1;
    return '${int.tryParse(iso.substring(8, 10)) ?? ''} ${m[mo - 1]} ${iso.substring(0, 4)}';
  }

  /// What each desk does, in a few plain words.
  List<String> _jobs(String role) => switch (role) {
        'cashier' => [
            'Take payment for orders',
            'Give the customer a receipt',
            'Ask the manager for money for shop expenses',
          ],
        'accounts' => [
            'Check every payment is real',
            'Send back a payment that does not match',
            'Keep the cash book',
          ],
        'store' => [
            'Find the order by its number',
            'Give out the goods, all or part',
            'Ask for items the shop uses',
          ],
        _ => [
            'See sales, stock and orders',
            'Approve expenses and salaries',
            'Change stock, prices and staff',
          ],
      };

  Widget _row(IconData icon, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(children: [
          Icon(icon, size: 17, color: _mid),
          const SizedBox(width: 10),
          Text(k, style: _txt(13, color: _mid)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(v.isEmpty ? '-' : v,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _txt(13, weight: FontWeight.w600, color: _ink)),
          ),
        ]),
      );

  Widget _link(IconData icon, String label, String url) => _Pressable(
        scale: 0.98,
        onTap: () => launchURL(url),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11),
          child: Row(children: [
            Icon(icon, size: 18, color: _brand),
            const SizedBox(width: 10),
            Expanded(
                child: Text(label,
                    style: _txt(13.5, weight: FontWeight.w600, color: _ink))),
            const Icon(Icons.open_in_new_rounded, size: 16, color: _light),
          ]),
        ),
      );

  BoxDecoration get _box => BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _hairline),
      );

  @override
  Widget build(BuildContext context) {
    final s = _Session();
    final me = _me ?? s.user ?? const {};
    final name = '${me['fullName'] ?? s.fullName}';
    final email = '${me['email'] ?? ''}';
    final initials = name.trim().isEmpty
        ? '?'
        : name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((w) => w.characters.first.toUpperCase())
            .join();

    return Column(
      children: [
        _Header(subtitle: '${_deskName(s.role)} · ${s.fullName}'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            children: [
              // Who it is.
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _brandPale,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _lime.withOpacity(0.6)),
                ),
                child: Row(children: [
                  Container(
                    width: 54,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                        color: _lime, shape: BoxShape.circle),
                    child: Text(initials,
                        style: _title(19,
                            weight: FontWeight.w800, color: _onLime)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: _title(17)),
                        const SizedBox(height: 4),
                        _Chip(_deskName(s.role), bg: _white, fg: _brandDark),
                      ],
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 12),

              // The details.
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: _box,
                child: Column(children: [
                  _row(Icons.phone_iphone_rounded, 'Phone',
                      '${me['phone'] ?? s.phone}'),
                  if (email.isNotEmpty && !email.endsWith('.invalid'))
                    _row(Icons.mail_outline_rounded, 'Email', email),
                  _row(Icons.badge_outlined, 'Desk', _deskName(s.role)),
                  if ('${me['memberSince'] ?? ''}'.isNotEmpty)
                    _row(Icons.event_available_rounded, 'Working since',
                        _day('${me['memberSince']}')),
                  _row(Icons.verified_user_outlined, 'Account',
                      '${me['status'] ?? 'active'}' == 'active'
                          ? 'Active'
                          : 'Stopped'),
                ]),
              ),
              const SizedBox(height: 12),

              // What this desk does.
              Container(
                padding: const EdgeInsets.all(14),
                decoration: _box,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Your work', style: _title(14.5)),
                    const SizedBox(height: 8),
                    for (final j in _jobs(s.role))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(children: [
                          const Icon(Icons.check_circle_rounded,
                              size: 16, color: _green),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(j,
                                  style: _txt(13, color: _inkSoft))),
                        ]),
                      ),
                    const SizedBox(height: 6),
                    Text('Everything you do is saved with your name.',
                        style: _txt(12, color: _mid)),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Help and the shop's rules.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: _box,
                child: Column(children: [
                  _link(Icons.privacy_tip_outlined, 'Privacy policy',
                      '$_panelBase/privacy'),
                  const Divider(height: 1, color: _hairline),
                  _link(Icons.desktop_windows_outlined, 'Open the web panel',
                      _panelBase),
                ]),
              ),
              const SizedBox(height: 8),
              Text(
                  'Staff accounts are opened and closed by the manager. '
                  'To change your details or close your account, ask the manager.',
                  style: _txt(12, color: _mid, height: 1.45)),
              const SizedBox(height: 16),
              _BigButton('Sign out', widget.onSignOut,
                  tint: _ember, soft: true),
              const SizedBox(height: 8),
              Text('Signing out returns this phone to the shop.',
                  textAlign: TextAlign.center, style: _txt(12, color: _mid)),
            ],
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  STORE — FIND AN ORDER, DELIVER WHAT IS DUE
//
//  Scan the QR on the customer's receipt (or type the number). The
//  order comes up with what was sold, what has already gone and what is
//  still to deliver. The store sets how many go now and confirms; only
//  that comes off the stock book, and the manager sees every delivery.
// ═══════════════════════════════════════════════════════════════

class _FindOrderTab extends StatefulWidget {
  const _FindOrderTab({required this.onExpired});
  final Future<void> Function() onExpired;

  @override
  State<_FindOrderTab> createState() => _FindOrderTabState();
}

class _FindOrderTabState extends State<_FindOrderTab> {
  final _no = TextEditingController();
  Map<String, dynamic>? _order;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _no.dispose();
    super.dispose();
  }

  Future<void> _find([String? code]) async {
    final raw = (code ?? _no.text).trim();
    if (raw.isEmpty) return;
    _no.text = raw;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r =
          await _apiGet('/api/store/lookup?no=${Uri.encodeComponent(raw)}');
      if (!mounted) return;
      setState(() {
        _order = (r['order'] as Map).cast<String, dynamic>();
        _busy = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await widget.onExpired();
        return;
      }
      setState(() {
        _order = null;
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          _Header(
              subtitle:
                  '${_deskName(_Session().role)} · ${_Session().fullName}'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
              children: [
                Text('Find an order',
                    style: _title(20, weight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('Type the order number from the receipt.',
                    style: _txt(13, color: _mid)),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                    child: _Field(
                      controller: _no,
                      hint: 'Order number, e.g. AH-115',
                      capitalisation: TextCapitalization.characters,
                    ),
                  ),
                  const SizedBox(width: 10),
                  _SmallButton('Find', () => _find()),
                ]),
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                        child: CircularProgressIndicator(color: _brand)),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(_error!, style: _txt(13.5, color: _ember, height: 1.4)),
                ],
                if (_order != null && !_busy) ...[
                  const SizedBox(height: 16),
                  _Delivery(
                    order: _order!,
                    onDone: (msg) async {
                      _toast(context, msg);
                      await _find();
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      );
}

/// One order at the store: what was sold, what has gone, what is due,
/// and how many go now.
class _Delivery extends StatefulWidget {
  const _Delivery({required this.order, required this.onDone});
  final Map<String, dynamic> order;
  final Future<void> Function(String message) onDone;

  @override
  State<_Delivery> createState() => _DeliveryState();
}

class _DeliveryState extends State<_Delivery> {
  final Map<int, double> _now = {};
  final _who = TextEditingController();
  bool _busy = false;
  String? _error;

  List<Map<String, dynamic>> get _items =>
      ((widget.order['items'] as List?) ?? const [])
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();

  @override
  void initState() {
    super.initState();
    for (final i in _items) {
      _now[_int(i['id'])] = _num(i['qty_to_deliver']);
    }
  }

  @override
  void dispose() {
    _who.dispose();
    super.dispose();
  }

  double get _going => _now.values.fold(0.0, (a, b) => a + b);

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _apiPost('/api/store/orders/${_int(widget.order['id'])}/release', {
        'lines': {
          for (final e in _now.entries)
            if (e.value > 0) '${e.key}': e.value,
        },
        'collectedBy': _who.text.trim(),
      });
      HapticFeedback.mediumImpact();
      await widget.onDone('Delivered. It is in the stock book.');
    } on _ApiError catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final can = o['canRelease'] == true;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Text('${o['order_no']}',
                style: _title(20, weight: FontWeight.w800)),
            const Spacer(),
            Text(_ugx(_int(o['total'])), style: _title(16)),
          ]),
          const SizedBox(height: 4),
          Text('${o['company_name'] ?? o['ordered_by_name'] ?? ''}',
              style: _txt(13.5, weight: FontWeight.w600)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: can ? _greenPale : _emberPale,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text('${o['advice'] ?? ''}',
                style: _txt(13.5,
                    weight: FontWeight.w600, color: can ? _green : _ember)),
          ),
          const SizedBox(height: 12),
          for (final i in _items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${i['product_name']}',
                          style: _txt(14, weight: FontWeight.w700, color: _ink)),
                      Text(
                          'Sold ${_qtyText(_num(i['quantity']))} · gone ${_qtyText(_num(i['qty_released']))} · '
                          'to deliver ${_qtyText(_num(i['qty_to_deliver']))} ${i['unit'] ?? ''}',
                          style: _txt(12, color: _mid)),
                    ],
                  ),
                ),
                if (can && _num(i['qty_to_deliver']) > 0) ...[
                  _Pressable(
                    scale: 0.85,
                    onTap: () => setState(() {
                      final id = _int(i['id']);
                      _now[id] = ((_now[id] ?? 0) - _step(i)).clamp(0.0, _num(i['qty_to_deliver']));
                    }),
                    child: const Icon(Icons.remove_circle_outline_rounded,
                        size: 26, color: _mid),
                  ),
                  SizedBox(
                    width: 40,
                    child: Text(_qtyText(_now[_int(i['id'])] ?? 0),
                        textAlign: TextAlign.center,
                        style: _title(16, weight: FontWeight.w800)),
                  ),
                  _Pressable(
                    scale: 0.85,
                    onTap: () => setState(() {
                      final id = _int(i['id']);
                      _now[id] = ((_now[id] ?? 0) + _step(i)).clamp(0.0, _num(i['qty_to_deliver']));
                    }),
                    child: const Icon(Icons.add_circle_outline_rounded,
                        size: 26, color: _brand),
                  ),
                ],
              ]),
            ),
          if (can) ...[
            const SizedBox(height: 8),
            _Field(
              controller: _who,
              hint: 'Who is collecting? (optional)',
              capitalisation: TextCapitalization.words,
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 12),
            _BigButton(
              _going == 0
                  ? 'Choose what goes now'
                  : 'Confirm delivery of ${_qtyText(_going)}',
              _going == 0 ? null : _confirm,
              busy: _busy,
              tint: _green,
            ),
          ],
        ],
      ),
    );
  }
}

/// The To release list opens the same delivery view, by number.
class _DeliverSheet extends StatefulWidget {
  const _DeliverSheet({required this.orderNo});
  final String orderNo;

  @override
  State<_DeliverSheet> createState() => _DeliverSheetState();
}

class _DeliverSheetState extends State<_DeliverSheet> {
  Map<String, dynamic>? _order;
  String? _error;

  @override
  void initState() {
    super.initState();
    _apiGet('/api/store/lookup?no=${Uri.encodeComponent(widget.orderNo)}')
        .then((r) {
      if (mounted) setState(() => _order = (r['order'] as Map).cast<String, dynamic>());
    }).catchError((e) {
      if (mounted) setState(() => _error = '$e');
    });
  }

  @override
  Widget build(BuildContext context) => _Sheet(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
              16, 8, 16, MediaQuery.paddingOf(context).bottom + 20),
          child: _order == null
              ? Padding(
                  padding: const EdgeInsets.all(24),
                  child: _error != null
                      ? Text(_error!, style: _txt(13.5, color: _ember))
                      : const Center(
                          child: CircularProgressIndicator(color: _brand)),
                )
              : _Delivery(
                  order: _order!,
                  onDone: (msg) async {
                    Navigator.of(context).pop(true);
                  },
                ),
        ),
      );
}


void _toast(BuildContext context, String message, {bool bad = false}) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: bad ? _ember : _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text(message, style: _txt(13.5, color: _white)),
      ),
    );
